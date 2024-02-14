/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { SortResults } from '@elastic/elasticsearch/lib/api/types';
import {
  ElasticsearchClient,
  Logger,
  SavedObjectsClientContract,
  SavedObjectsFindResponse,
} from '@kbn/core/server';
import { SLO_SUMMARY_DESTINATION_INDEX_PATTERN } from '@kbn/observability-plugin/common/slo/constants';
import { ObservabilityConfig } from '@kbn/observability-plugin/server';
import { SO_SLO_SETTINGS_TYPE } from '@kbn/observability-plugin/server/saved_objects';
import { SLOSettingsStored } from '@kbn/slo-schema';
import {
  ConcreteTaskInstance,
  TaskManagerSetupContract,
  TaskManagerStartContract,
} from '@kbn/task-manager-plugin/server';

export const TASK_TYPE = 'SLO:STALE_SUMMARY_INSTANCES_CLEANUP_TASK';

export class SloOrphanSummaryCleanupTask {
  private abortController = new AbortController();
  private logger: Logger;
  private taskManager?: TaskManagerStartContract;
  private soClient?: SavedObjectsClientContract;
  private esClient?: ElasticsearchClient;
  private config: ObservabilityConfig;

  constructor(taskManager: TaskManagerSetupContract, logger: Logger, config: ObservabilityConfig) {
    this.logger = logger;
    this.config = config;

    taskManager.registerTaskDefinitions({
      [TASK_TYPE]: {
        title: 'Stale SLO summary instances cleanup task',
        timeout: '5m',
        maxAttempts: 1,
        createTaskRunner: ({ taskInstance }: { taskInstance: ConcreteTaskInstance }) => {
          return {
            run: async () => {
              return this.runTask();
            },

            cancel: async () => {
              this.abortController.abort(
                '[SLO] Stale SLO summary instances cleanup task timed out'
              );
            },
          };
        },
      },
    });
  }

  runTask = async () => {
    if (!this.soClient || !this.esClient) {
      return;
    }

    let searchAfterKey: SortResults | undefined = undefined;
    do {
      const sloSettings: SavedObjectsFindResponse<SLOSettingsStored> =
        await this.soClient.find<SLOSettingsStored>({
          type: SO_SLO_SETTINGS_TYPE,
          namespaces: ['*'],
          perPage: 100,
          sortField: 'created_at',
          ...(searchAfterKey ? { searchAfter: searchAfterKey } : {}),
        });

      const lastSloSettings = sloSettings.saved_objects.slice(-1)[0];
      searchAfterKey = lastSloSettings?.sort;

      const enabledStaleCleanupSloSettings = sloSettings.saved_objects.filter(
        (so) => so.attributes.stale.enabled === true && so.namespaces?.[0] !== undefined
      );

      await this.esClient.deleteByQuery({
        index: SLO_SUMMARY_DESTINATION_INDEX_PATTERN,
        wait_for_completion: false,
        query: {
          bool: {
            should: enabledStaleCleanupSloSettings.map((spaceAwareSloSettings) => ({
              bool: {
                must: [
                  {
                    term: {
                      spaceId: spaceAwareSloSettings.namespaces![0],
                    },
                  },
                  {
                    range: {
                      summaryUpdatedAt: {
                        lt: `now-${spaceAwareSloSettings.attributes.stale.duration}m`,
                      },
                    },
                  },
                ],
              },
            })),
          },
        },
      });
    } while (searchAfterKey);
  };

  private get taskId() {
    return `${TASK_TYPE}:1.0.0`;
  }

  public async start(
    taskManager: TaskManagerStartContract,
    soClient: SavedObjectsClientContract,
    esClient: ElasticsearchClient
  ) {
    this.taskManager = taskManager;
    this.soClient = soClient;
    this.esClient = esClient;

    if (!taskManager) {
      this.logger.info('[SLO] Missing required service during startup, skipping task.');
      return;
    }

    if (this.config.sloStaleSummaryCleanUpTaskEnabled) {
      this.taskManager.ensureScheduled({
        id: this.taskId,
        taskType: TASK_TYPE,
        schedule: {
          interval: '1h',
        },
        scope: ['observability', 'slo'],
        state: {},
        params: {},
      });
    } else {
      this.taskManager.removeIfExists(this.taskId);
    }
  }
}
