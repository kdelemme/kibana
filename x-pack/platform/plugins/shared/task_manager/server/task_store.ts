/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

/*
 * This module contains helpers for managing the task manager storage layer.
 */
import murmurhash from 'murmurhash';
import { v4 } from 'uuid';
import { Subject } from 'rxjs';
import { omit, defaults, get } from 'lodash';
import type { SavedObjectError } from '@kbn/core-saved-objects-common';

import type { estypes } from '@elastic/elasticsearch';
import type { SavedObjectsBulkDeleteResponse, Logger } from '@kbn/core/server';

import type {
  SavedObject,
  ISavedObjectsSerializer,
  SavedObjectsRawDoc,
  ISavedObjectsRepository,
  SavedObjectsUpdateResponse,
  ElasticsearchClient,
} from '@kbn/core/server';

import { decodeRequestVersion, encodeVersion } from '@kbn/core-saved-objects-base-server-internal';
import type { RequestTimeoutsConfig } from './config';
import type { Result } from './lib/result_type';
import { asOk, asErr } from './lib/result_type';

import type {
  ConcreteTaskInstance,
  ConcreteTaskInstanceVersion,
  TaskInstance,
  TaskLifecycle,
  SerializedConcreteTaskInstance,
  PartialConcreteTaskInstance,
  PartialSerializedConcreteTaskInstance,
} from './task';
import { TaskStatus, TaskLifecycleResult } from './task';

import type { TaskTypeDictionary } from './task_type_dictionary';
import type { AdHocTaskCounter } from './lib/adhoc_task_counter';
import { TaskValidator } from './task_validator';
import { claimSort } from './queries/mark_available_tasks_as_claimed';
import { MAX_PARTITIONS } from './lib/task_partitioner';
import type { ErrorOutput } from './lib/bulk_operation_buffer';
import { MsearchError } from './lib/msearch_error';
import { BulkUpdateError } from './lib/bulk_update_error';

export interface StoreOpts {
  esClient: ElasticsearchClient;
  index: string;
  taskManagerId: string;
  definitions: TaskTypeDictionary;
  savedObjectsRepository: ISavedObjectsRepository;
  serializer: ISavedObjectsSerializer;
  adHocTaskCounter: AdHocTaskCounter;
  allowReadingInvalidState: boolean;
  logger: Logger;
  requestTimeouts: RequestTimeoutsConfig;
}

export interface SearchOpts {
  search_after?: Array<number | string>;
  size?: number;
  sort?: estypes.Sort;
  query?: estypes.QueryDslQueryContainer;
  seq_no_primary_term?: boolean;
}

export interface AggregationOpts {
  aggs: Record<string, estypes.AggregationsAggregationContainer>;
  query?: estypes.QueryDslQueryContainer;
  runtime_mappings?: estypes.MappingRuntimeFields;
  size?: number;
}

export interface UpdateByQuerySearchOpts extends SearchOpts {
  script?: estypes.Script;
}

export interface UpdateByQueryOpts extends SearchOpts {
  max_docs?: number;
}

export interface FetchResult {
  docs: ConcreteTaskInstance[];
  versionMap: Map<string, ConcreteTaskInstanceVersion>;
}

export interface BulkUpdateOpts {
  validate: boolean;
}

export type BulkUpdateResult = Result<ConcreteTaskInstance, ErrorOutput>;

export type PartialBulkUpdateResult = Result<PartialConcreteTaskInstance, ErrorOutput>;

export type BulkGetResult = Array<
  Result<ConcreteTaskInstance, { type: string; id: string; error: SavedObjectError }>
>;

export interface UpdateByQueryResult {
  updated: number;
  version_conflicts: number;
  total: number;
}

/**
 * Wraps an elasticsearch connection and provides a task manager-specific
 * interface into the index.
 */
export class TaskStore {
  public readonly index: string;
  public readonly taskManagerId: string;
  public readonly errors$ = new Subject<Error>();
  public readonly taskValidator: TaskValidator;

  private esClient: ElasticsearchClient;
  private esClientWithoutRetries: ElasticsearchClient;
  private definitions: TaskTypeDictionary;
  private savedObjectsRepository: ISavedObjectsRepository;
  private serializer: ISavedObjectsSerializer;
  private adHocTaskCounter: AdHocTaskCounter;
  private requestTimeouts: RequestTimeoutsConfig;

  /**
   * Constructs a new TaskStore.
   * @param {StoreOpts} opts
   * @prop {esClient} esClient - An elasticsearch client
   * @prop {string} index - The name of the task manager index
   * @prop {TaskDefinition} definition - The definition of the task being run
   * @prop {serializer} - The saved object serializer
   * @prop {savedObjectsRepository} - An instance to the saved objects repository
   */
  constructor(opts: StoreOpts) {
    this.esClient = opts.esClient;
    this.index = opts.index;
    this.taskManagerId = opts.taskManagerId;
    this.definitions = opts.definitions;
    this.serializer = opts.serializer;
    this.savedObjectsRepository = opts.savedObjectsRepository;
    this.adHocTaskCounter = opts.adHocTaskCounter;
    this.taskValidator = new TaskValidator({
      logger: opts.logger,
      definitions: opts.definitions,
      allowReadingInvalidState: opts.allowReadingInvalidState,
    });
    this.esClientWithoutRetries = opts.esClient.child({
      // Timeouts are retried and make requests timeout after (requestTimeout * (1 + maxRetries))
      // The poller doesn't need retry logic because it will try again at the next polling cycle
      maxRetries: 0,
    });
    this.requestTimeouts = opts.requestTimeouts;
  }

  /**
   * Convert ConcreteTaskInstance Ids to match their SavedObject format as serialized
   * in Elasticsearch
   * @param tasks - The task being scheduled.
   */
  public convertToSavedObjectIds(
    taskIds: Array<ConcreteTaskInstance['id']>
  ): Array<ConcreteTaskInstance['id']> {
    return taskIds.map((id) => this.serializer.generateRawId(undefined, 'task', id));
  }

  /**
   * Schedules a task.
   *
   * @param task - The task being scheduled.
   */
  public async schedule(taskInstance: TaskInstance): Promise<ConcreteTaskInstance> {
    this.definitions.ensureHas(taskInstance.taskType);

    let savedObject;
    try {
      const id = taskInstance.id || v4();
      const validatedTaskInstance =
        this.taskValidator.getValidatedTaskInstanceForUpdating(taskInstance);
      savedObject = await this.savedObjectsRepository.create<SerializedConcreteTaskInstance>(
        'task',
        taskInstanceToAttributes(validatedTaskInstance, id),
        { id, refresh: false }
      );
      if (get(taskInstance, 'schedule.interval', null) == null) {
        this.adHocTaskCounter.increment();
      }
    } catch (e) {
      this.errors$.next(e);
      throw e;
    }

    const result = savedObjectToConcreteTaskInstance(savedObject);
    return this.taskValidator.getValidatedTaskInstanceFromReading(result);
  }

  /**
   * Bulk schedules a task.
   *
   * @param tasks - The tasks being scheduled.
   */
  public async bulkSchedule(taskInstances: TaskInstance[]): Promise<ConcreteTaskInstance[]> {
    const objects = taskInstances.map((taskInstance) => {
      const id = taskInstance.id || v4();
      this.definitions.ensureHas(taskInstance.taskType);
      const validatedTaskInstance =
        this.taskValidator.getValidatedTaskInstanceForUpdating(taskInstance);
      return {
        type: 'task',
        attributes: taskInstanceToAttributes(validatedTaskInstance, id),
        id,
      };
    });

    let savedObjects;
    try {
      savedObjects = await this.savedObjectsRepository.bulkCreate<SerializedConcreteTaskInstance>(
        objects,
        { refresh: false }
      );
      this.adHocTaskCounter.increment(
        taskInstances.filter((task) => {
          return get(task, 'schedule.interval', null) == null;
        }).length
      );
    } catch (e) {
      this.errors$.next(e);
      throw e;
    }

    return savedObjects.saved_objects.map((so) => {
      const taskInstance = savedObjectToConcreteTaskInstance(so);
      return this.taskValidator.getValidatedTaskInstanceFromReading(taskInstance);
    });
  }

  /**
   * Fetches a list of scheduled tasks with default sorting.
   *
   * @param opts - The query options used to filter tasks
   * @param limitResponse - Whether to exclude the task state and params from the source for a smaller respose payload
   */
  public async fetch(
    { sort = [{ 'task.runAt': 'asc' }], ...opts }: SearchOpts = {},
    limitResponse: boolean = false
  ): Promise<FetchResult> {
    return this.search({ ...opts, sort }, limitResponse);
  }

  /**
   * Updates the specified doc in the index, returning the doc
   * with its version up to date.
   *
   * @param {TaskDoc} doc
   * @returns {Promise<TaskDoc>}
   */
  public async update(
    doc: ConcreteTaskInstance,
    options: { validate: boolean }
  ): Promise<ConcreteTaskInstance> {
    const taskInstance = this.taskValidator.getValidatedTaskInstanceForUpdating(doc, {
      validate: options.validate,
    });
    const attributes = taskInstanceToAttributes(taskInstance, doc.id);

    let updatedSavedObject;
    try {
      updatedSavedObject = await this.savedObjectsRepository.update<SerializedConcreteTaskInstance>(
        'task',
        doc.id,
        attributes,
        {
          refresh: false,
          version: doc.version,
        }
      );
    } catch (e) {
      this.errors$.next(e);
      throw e;
    }

    const result = savedObjectToConcreteTaskInstance(
      // The SavedObjects update api forces a Partial on the `attributes` on the response,
      // but actually returns the whole object that is passed to it, so as we know we're
      // passing in the whole object, this is safe to do.
      // This is far from ideal, but unless we change the SavedObjectsClient this is the best we can do
      { ...updatedSavedObject, attributes: defaults(updatedSavedObject.attributes, attributes) }
    );
    return this.taskValidator.getValidatedTaskInstanceFromReading(result, {
      validate: options.validate,
    });
  }

  /**
   * Updates the specified docs in the index, returning the docs
   * with their versions up to date.
   *
   * @param {Array<TaskDoc>} docs
   * @returns {Promise<Array<TaskDoc>>}
   */
  public async bulkUpdate(
    docs: ConcreteTaskInstance[],
    { validate }: BulkUpdateOpts
  ): Promise<BulkUpdateResult[]> {
    const attributesByDocId = docs.reduce((attrsById, doc) => {
      const taskInstance = this.taskValidator.getValidatedTaskInstanceForUpdating(doc, {
        validate,
      });
      attrsById.set(doc.id, taskInstanceToAttributes(taskInstance, doc.id));
      return attrsById;
    }, new Map());

    let updatedSavedObjects: Array<SavedObjectsUpdateResponse<SerializedConcreteTaskInstance>>;
    try {
      ({ saved_objects: updatedSavedObjects } =
        await this.savedObjectsRepository.bulkUpdate<SerializedConcreteTaskInstance>(
          docs.map((doc) => ({
            type: 'task',
            id: doc.id,
            version: doc.version,
            attributes: attributesByDocId.get(doc.id)!,
          })),
          {
            refresh: false,
          }
        ));
    } catch (e) {
      this.errors$.next(e);
      throw e;
    }

    return updatedSavedObjects.map((updatedSavedObject) => {
      if (updatedSavedObject.error !== undefined) {
        return asErr({
          type: 'task',
          id: updatedSavedObject.id,
          error: updatedSavedObject.error,
        });
      }

      const taskInstance = savedObjectToConcreteTaskInstance({
        ...updatedSavedObject,
        attributes: defaults(
          updatedSavedObject.attributes,
          attributesByDocId.get(updatedSavedObject.id)!
        ),
      });
      const result = this.taskValidator.getValidatedTaskInstanceFromReading(taskInstance, {
        validate,
      });
      return asOk(result);
    });
  }

  public async bulkPartialUpdate(
    docs: PartialConcreteTaskInstance[]
  ): Promise<PartialBulkUpdateResult[]> {
    if (docs.length === 0) {
      return [];
    }

    const bulkBody = [];
    for (const doc of docs) {
      bulkBody.push({
        update: {
          _id: `task:${doc.id}`,
          ...(doc.version ? decodeRequestVersion(doc.version) : {}),
        },
      });
      bulkBody.push({
        doc: {
          task: partialTaskInstanceToAttributes(doc),
        },
      });
    }

    let result: estypes.BulkResponse;
    try {
      result = await this.esClient.bulk({ index: this.index, refresh: false, body: bulkBody });
    } catch (e) {
      this.errors$.next(e);
      throw e;
    }

    return result.items.map((item) => {
      const malformedResponseType = 'malformed response';

      if (!item.update || !item.update._id) {
        const err = new BulkUpdateError({
          message: malformedResponseType,
          type: malformedResponseType,
          statusCode: 500,
        });
        this.errors$.next(err);
        return asErr({
          type: 'task',
          id: 'unknown',
          error: { type: malformedResponseType },
        });
      }

      const docId = item.update._id.startsWith('task:')
        ? item.update._id.slice(5)
        : item.update._id;

      if (item.update?.error) {
        const err = new BulkUpdateError({
          message: item.update.error.reason,
          type: item.update.error.type,
          statusCode: item.update.status,
        });
        this.errors$.next(err);
        return asErr({
          type: 'task',
          id: docId,
          status: item.update.status,
          error: item.update.error,
        });
      }

      const doc = docs.find((d) => d.id === docId);

      return asOk({
        ...doc,
        id: docId,
        version: encodeVersion(item.update._seq_no, item.update._primary_term),
      });
    });
  }

  /**
   * Removes the specified task from the index.
   *
   * @param {string} id
   * @returns {Promise<void>}
   */
  public async remove(id: string): Promise<void> {
    try {
      await this.savedObjectsRepository.delete('task', id, { refresh: false });
    } catch (e) {
      this.errors$.next(e);
      throw e;
    }
  }

  /**
   * Bulk removes the specified tasks from the index.
   *
   * @param {SavedObjectsBulkDeleteObject[]} savedObjectsToDelete
   * @returns {Promise<SavedObjectsBulkDeleteResponse>}
   */
  public async bulkRemove(taskIds: string[]): Promise<SavedObjectsBulkDeleteResponse> {
    try {
      const savedObjectsToDelete = taskIds.map((taskId) => ({ id: taskId, type: 'task' }));
      return await this.savedObjectsRepository.bulkDelete(savedObjectsToDelete, { refresh: false });
    } catch (e) {
      this.errors$.next(e);
      throw e;
    }
  }

  /**
   * Gets a task by id
   *
   * @param {string} id
   * @returns {Promise<void>}
   */
  public async get(id: string): Promise<ConcreteTaskInstance> {
    let result;
    try {
      result = await this.savedObjectsRepository.get<SerializedConcreteTaskInstance>('task', id);
    } catch (e) {
      this.errors$.next(e);
      throw e;
    }
    const taskInstance = savedObjectToConcreteTaskInstance(result);
    return taskInstance;
  }

  /**
   * Gets tasks by ids
   *
   * @param {Array<string>} ids
   * @returns {Promise<ConcreteTaskInstance[]>}
   */
  public async bulkGet(ids: string[]): Promise<BulkGetResult> {
    let result;
    try {
      result = await this.savedObjectsRepository.bulkGet<SerializedConcreteTaskInstance>(
        ids.map((id) => ({ type: 'task', id }))
      );
    } catch (e) {
      this.errors$.next(e);
      throw e;
    }
    return result.saved_objects.map((task) => {
      if (task.error) {
        return asErr({ id: task.id, type: task.type, error: task.error });
      }
      const taskInstance = savedObjectToConcreteTaskInstance(task);
      return asOk(taskInstance);
    });
  }

  /**
   * Gets task version info by ids
   *
   * @param {Array<string>} esIds
   * @returns {Promise<ConcreteTaskInstance[]>}
   */
  public async bulkGetVersions(ids: string[]): Promise<ConcreteTaskInstanceVersion[]> {
    let taskVersions: estypes.MgetResponse<never>;
    try {
      taskVersions = await this.esClientWithoutRetries.mget<never>({
        index: this.index,
        _source: false,
        ids,
      });
    } catch (e) {
      this.errors$.next(e);
      throw e;
    }

    const result = taskVersions.docs.map((taskVersion) => {
      if (isMGetSuccess(taskVersion)) {
        if (!taskVersion.found) {
          return {
            esId: taskVersion._id,
            error: `task "${taskVersion._id}" not found`,
          };
        } else {
          return {
            esId: taskVersion._id,
            seqNo: taskVersion._seq_no,
            primaryTerm: taskVersion._primary_term,
          };
        }
      }

      const type = taskVersion.error?.type || 'unknown type of error';
      const reason = taskVersion.error?.reason || 'unknown reason';
      const error = `error getting version for ${taskVersion._id}: ${type}: ${reason}`;
      return {
        esId: taskVersion._id,
        error,
      };
    });

    return result;
  }

  /**
   * Gets task lifecycle step by id
   *
   * @param {string} id
   * @returns {Promise<void>}
   */
  public async getLifecycle(id: string): Promise<TaskLifecycle> {
    try {
      const task = await this.get(id);
      return task.status;
    } catch (err) {
      if (err.output && err.output.statusCode === 404) {
        return TaskLifecycleResult.NotFound;
      }
      throw err;
    }
  }

  // like search(), only runs multiple searches in parallel returning the combined results
  async msearch(opts: SearchOpts[] = []): Promise<FetchResult> {
    const queries = opts.map(({ sort = [{ 'task.runAt': 'asc' }], ...opt }) =>
      ensureQueryOnlyReturnsTaskObjects({ sort, ...opt })
    );
    const searches = queries.flatMap((query) => [{}, query]);

    const result = await this.esClientWithoutRetries.msearch<SavedObjectsRawDoc['_source']>({
      index: this.index,
      ignore_unavailable: true,
      searches,
    });
    const { responses } = result;

    const versionMap = this.createVersionMap([]);
    let allTasks = new Array<ConcreteTaskInstance>();

    for (const response of responses) {
      if (response.status !== 200) {
        const err = new MsearchError(response.status);
        this.errors$.next(err);
        throw err;
      }

      const { hits } = response as estypes.MsearchMultiSearchItem<SavedObjectsRawDoc['_source']>;
      const { hits: tasks } = hits;
      this.addTasksToVersionMap(versionMap, tasks);
      allTasks = allTasks.concat(this.filterTasks(tasks));
    }

    const allSortedTasks = claimSort(this.definitions, allTasks);

    return { docs: allSortedTasks, versionMap };
  }

  private async search(
    opts: SearchOpts = {},
    limitResponse: boolean = false
  ): Promise<FetchResult> {
    const { query } = ensureQueryOnlyReturnsTaskObjects(opts);

    try {
      const result = await this.esClientWithoutRetries.search<SavedObjectsRawDoc['_source']>({
        index: this.index,
        ignore_unavailable: true,
        ...opts,
        query,
        ...(limitResponse ? { _source_excludes: ['task.state', 'task.params'] } : {}),
      });

      const {
        hits: { hits: tasks },
      } = result;

      const versionMap = this.createVersionMap(tasks);
      return {
        docs: this.filterTasks(tasks),
        versionMap,
      };
    } catch (e) {
      this.errors$.next(e);
      throw e;
    }
  }

  private filterTasks(
    tasks: Array<estypes.SearchHit<SavedObjectsRawDoc['_source']>>
  ): ConcreteTaskInstance[] {
    return (
      tasks
        // @ts-expect-error @elastic/elasticsearch _source is optional
        .filter((doc) => this.serializer.isRawSavedObject(doc))
        // @ts-expect-error @elastic/elasticsearch _source is optional
        .map((doc) => this.serializer.rawToSavedObject(doc))
        .map((doc) => omit(doc, 'namespace') as SavedObject<SerializedConcreteTaskInstance>)
        .map((doc) => savedObjectToConcreteTaskInstance(doc))
        .filter((doc): doc is ConcreteTaskInstance => !!doc)
    );
  }

  private addTasksToVersionMap(
    versionMap: Map<string, ConcreteTaskInstanceVersion>,
    tasks: Array<estypes.SearchHit<SavedObjectsRawDoc['_source']>>
  ): void {
    for (const task of tasks) {
      if (task._id == null || task._seq_no == null || task._primary_term == null) continue;

      const esId = task._id.startsWith('task:') ? task._id.slice(5) : task._id;
      versionMap.set(esId, {
        esId: task._id,
        seqNo: task._seq_no,
        primaryTerm: task._primary_term,
      });
    }
  }

  private createVersionMap(
    tasks: Array<estypes.SearchHit<SavedObjectsRawDoc['_source']>>
  ): Map<string, ConcreteTaskInstanceVersion> {
    const versionMap = new Map<string, ConcreteTaskInstanceVersion>();
    this.addTasksToVersionMap(versionMap, tasks);
    return versionMap;
  }

  public async aggregate<TSearchRequest extends AggregationOpts>({
    aggs,
    query,
    // eslint-disable-next-line @typescript-eslint/naming-convention
    runtime_mappings,
    size = 0,
  }: TSearchRequest): Promise<estypes.SearchResponse<ConcreteTaskInstance>> {
    const body = await this.esClient.search<
      ConcreteTaskInstance,
      Record<string, estypes.AggregationsAggregate>
    >({
      index: this.index,
      ignore_unavailable: true,
      track_total_hits: true,
      ...ensureAggregationOnlyReturnsEnabledTaskObjects({
        query,
        aggs,
        runtime_mappings,
        size,
      }),
    });
    return body;
  }

  public async updateByQuery(
    opts: UpdateByQuerySearchOpts = {},
    // eslint-disable-next-line @typescript-eslint/naming-convention
    { max_docs: max_docs }: UpdateByQueryOpts = {}
  ): Promise<UpdateByQueryResult> {
    const { query } = ensureQueryOnlyReturnsTaskObjects(opts);
    try {
      const // @ts-expect-error elasticsearch@9.0.0 https://github.com/elastic/elasticsearch-js/issues/2584 types complain because the body should not be there.
        // However, we can't use this API without the body because it fails to claim the tasks.
        // eslint-disable-next-line @typescript-eslint/naming-convention
        { total, updated, version_conflicts } = await this.esClientWithoutRetries.updateByQuery(
          {
            index: this.index,
            ignore_unavailable: true,
            refresh: true,
            conflicts: 'proceed',
            body: {
              ...opts,
              max_docs,
              query,
            },
          },
          { requestTimeout: this.requestTimeouts.update_by_query }
        );

      const conflictsCorrectedForContinuation = correctVersionConflictsForContinuation(
        updated,
        version_conflicts,
        max_docs
      );

      return {
        total: total || 0,
        updated: updated || 0,
        version_conflicts: conflictsCorrectedForContinuation,
      };
    } catch (e) {
      this.errors$.next(e);
      throw e;
    }
  }

  public async getDocVersions(esIds: string[]): Promise<Map<string, ConcreteTaskInstanceVersion>> {
    const versions = await this.bulkGetVersions(esIds);
    const result = new Map<string, ConcreteTaskInstanceVersion>();
    for (const version of versions) {
      result.set(version.esId, version);
    }
    return result;
  }
}

/**
 * When we run updateByQuery with conflicts='proceed', it's possible for the `version_conflicts`
 * to count against the specified `max_docs`, as per https://github.com/elastic/elasticsearch/issues/63671
 * In order to correct for that happening, we only count `version_conflicts` if we haven't updated as
 * many docs as we could have.
 * This is still no more than an estimation, as there might have been less docuemnt to update that the
 * `max_docs`, but we bias in favour of over zealous `version_conflicts` as that's the best indicator we
 * have for an unhealthy cluster distribution of Task Manager polling intervals
 */

export function correctVersionConflictsForContinuation(
  updated: estypes.ReindexResponse['updated'],
  versionConflicts: estypes.ReindexResponse['version_conflicts'],
  maxDocs?: number
): number {
  // @ts-expect-error estypes.ReindexResponse['updated'] and estypes.ReindexResponse['version_conflicts'] can be undefined
  return maxDocs && versionConflicts + updated > maxDocs ? maxDocs - updated : versionConflicts;
}

export function taskInstanceToAttributes(
  doc: TaskInstance,
  id: string
): SerializedConcreteTaskInstance {
  return {
    ...omit(doc, 'id', 'version'),
    params: JSON.stringify(doc.params || {}),
    state: JSON.stringify(doc.state || {}),
    attempts: (doc as ConcreteTaskInstance).attempts || 0,
    scheduledAt: (doc.scheduledAt || new Date()).toISOString(),
    startedAt: (doc.startedAt && doc.startedAt.toISOString()) || null,
    retryAt: (doc.retryAt && doc.retryAt.toISOString()) || null,
    runAt: (doc.runAt || new Date()).toISOString(),
    status: (doc as ConcreteTaskInstance).status || 'idle',
    partition: doc.partition || murmurhash.v3(id) % MAX_PARTITIONS,
  } as SerializedConcreteTaskInstance;
}

export function partialTaskInstanceToAttributes(
  doc: PartialConcreteTaskInstance
): PartialSerializedConcreteTaskInstance {
  return {
    ...omit(doc, 'id', 'version'),
    ...(doc.params ? { params: JSON.stringify(doc.params) } : {}),
    ...(doc.state ? { state: JSON.stringify(doc.state) } : {}),
    ...(doc.scheduledAt ? { scheduledAt: doc.scheduledAt.toISOString() } : {}),
    ...(doc.startedAt ? { startedAt: doc.startedAt.toISOString() } : {}),
    ...(doc.retryAt ? { retryAt: doc.retryAt.toISOString() } : {}),
    ...(doc.runAt ? { runAt: doc.runAt.toISOString() } : {}),
  } as PartialSerializedConcreteTaskInstance;
}

export function savedObjectToConcreteTaskInstance(
  savedObject: Omit<SavedObject<SerializedConcreteTaskInstance>, 'references'>
): ConcreteTaskInstance {
  return {
    ...savedObject.attributes,
    id: savedObject.id,
    version: savedObject.version,
    scheduledAt: new Date(savedObject.attributes.scheduledAt),
    runAt: new Date(savedObject.attributes.runAt),
    startedAt: savedObject.attributes.startedAt ? new Date(savedObject.attributes.startedAt) : null,
    retryAt: savedObject.attributes.retryAt ? new Date(savedObject.attributes.retryAt) : null,
    state: parseJSONField(savedObject.attributes.state, 'state', savedObject.id),
    params: parseJSONField(savedObject.attributes.params, 'params', savedObject.id),
  };
}

function parseJSONField(json: string, fieldName: string, id: string) {
  try {
    return json ? JSON.parse(json) : {};
  } catch (error) {
    throw new Error(`Task "${id}"'s ${fieldName} field has invalid JSON: ${json}`);
  }
}

function ensureQueryOnlyReturnsTaskObjects(opts: SearchOpts): SearchOpts {
  const originalQuery = opts.query;
  const queryOnlyTasks = { term: { type: 'task' } };
  const query = originalQuery
    ? { bool: { must: [queryOnlyTasks, originalQuery] } }
    : queryOnlyTasks;

  return {
    ...opts,
    query,
  };
}

function ensureAggregationOnlyReturnsEnabledTaskObjects(opts: AggregationOpts): AggregationOpts {
  const originalQuery = opts.query;
  const filterToOnlyTasks = {
    bool: {
      filter: {
        bool: {
          must: [{ term: { type: 'task' } }, { term: { 'task.enabled': true } }],
          must_not: [{ term: { 'task.status': TaskStatus.Unrecognized } }],
        },
      },
    },
  };
  const query = originalQuery
    ? { bool: { must: [filterToOnlyTasks, originalQuery] } }
    : filterToOnlyTasks;
  return {
    ...opts,
    query,
  };
}

function isMGetSuccess(doc: estypes.MgetResponseItem<unknown>): doc is estypes.GetGetResult {
  return (doc as estypes.GetGetResult).found !== undefined;
}
