/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import {
  ACTION_POLICY_EXECUTIONS_DATA_STREAM,
  ACTION_POLICY_EXECUTIONS_RESOURCE_KEY,
  type ActionPolicyExecution,
} from '../../../resources/datastreams/action_policy_executions';
import { createLoggerService } from '../../services/logger_service/logger_service.mock';
import { createMockResourceManager } from '../../services/resource_service/resource_manager.mock';
import type { StorageServiceContract } from '../../services/storage_service/storage_service';
import {
  createActionGroup,
  createActionPolicy,
  createAlertEpisode,
  createDispatcherPipelineState,
  createRule,
} from '../fixtures/test_utils';
import type { RuleId, Rule } from '../types';
import { StoreExecutionHistoryStep } from './store_execution_history_step';

const createMockStorageService = (): jest.Mocked<StorageServiceContract> => ({
  bulkIndexDocs: jest.fn(),
});

describe('StoreExecutionHistoryStep', () => {
  let storageService: jest.Mocked<StorageServiceContract>;
  let resourceManager: ReturnType<typeof createMockResourceManager>;

  beforeEach(() => {
    storageService = createMockStorageService();
    resourceManager = createMockResourceManager();
    resourceManager.isReady.mockReturnValue(true);
  });

  afterEach(() => jest.clearAllMocks());

  it('writes a dispatched record per episode in each dispatch group', async () => {
    const { loggerService } = createLoggerService();
    const step = new StoreExecutionHistoryStep(storageService, resourceManager, loggerService);

    const episode = createAlertEpisode({ episode_id: 'ep-1' });
    const group = createActionGroup({
      id: 'group-1',
      policyId: 'policy-1',
      destinations: [{ type: 'workflow', id: 'workflow-1' }],
      episodes: [episode],
    });
    const policy = createActionPolicy({ id: 'policy-1', name: 'My policy' });
    const rule = createRule({ id: 'rule-1', name: 'My rule' });

    const state = createDispatcherPipelineState({
      dispatch: [group],
      dispatchable: [episode],
      policies: new Map([['policy-1', policy]]),
      rules: new Map<RuleId, Rule>([['rule-1', rule]]),
    });

    const result = await step.execute(state);

    expect(result).toEqual({ type: 'continue' });
    expect(storageService.bulkIndexDocs).toHaveBeenCalledTimes(1);
    const call = storageService.bulkIndexDocs.mock.calls[0][0];
    expect(call.index).toBe(ACTION_POLICY_EXECUTIONS_DATA_STREAM);
    expect(call.docs).toEqual<ActionPolicyExecution[]>([
      {
        '@timestamp': state.input.startedAt.toISOString(),
        action_policy_id: 'policy-1',
        action_policy_name: 'My policy',
        rule_id: 'rule-1',
        rule_name: 'My rule',
        group_hash: episode.group_hash,
        episode_id: 'ep-1',
        episode_status: episode.episode_status,
        outcome: 'dispatched',
        workflow_ids: ['workflow-1'],
        action_group_id: 'group-1',
        space_id: 'default',
      },
    ]);
  });

  it('writes a throttled record per episode in each throttled group', async () => {
    const { loggerService } = createLoggerService();
    const step = new StoreExecutionHistoryStep(storageService, resourceManager, loggerService);

    const episode = createAlertEpisode({ episode_id: 'ep-2' });
    const group = createActionGroup({
      id: 'group-2',
      policyId: 'policy-1',
      episodes: [episode],
    });
    const policy = createActionPolicy({ id: 'policy-1', name: 'My policy' });

    const state = createDispatcherPipelineState({
      throttled: [group],
      dispatchable: [episode],
      policies: new Map([['policy-1', policy]]),
      rules: new Map<RuleId, Rule>([['rule-1', createRule({ id: 'rule-1' })]]),
    });

    await step.execute(state);

    const call = storageService.bulkIndexDocs.mock.calls[0][0];
    expect(call.docs).toHaveLength(1);
    expect(call.docs[0].outcome).toBe('throttled');
    expect(call.docs[0].action_policy_id).toBe('policy-1');
    expect(call.docs[0].action_group_id).toBe('group-2');
  });

  it('writes an unmatched record for dispatchable episodes not in any group', async () => {
    const { loggerService } = createLoggerService();
    const step = new StoreExecutionHistoryStep(storageService, resourceManager, loggerService);

    const unmatchedEpisode = createAlertEpisode({ episode_id: 'ep-unmatched' });
    const rule = createRule({ id: 'rule-1', name: 'R', spaceId: 'my-space' });

    const state = createDispatcherPipelineState({
      dispatchable: [unmatchedEpisode],
      rules: new Map<RuleId, Rule>([['rule-1', rule]]),
    });

    await step.execute(state);

    const call = storageService.bulkIndexDocs.mock.calls[0][0];
    expect(call.docs).toEqual<ActionPolicyExecution[]>([
      {
        '@timestamp': state.input.startedAt.toISOString(),
        action_policy_id: null,
        action_policy_name: null,
        rule_id: 'rule-1',
        rule_name: 'R',
        group_hash: unmatchedEpisode.group_hash,
        episode_id: 'ep-unmatched',
        episode_status: unmatchedEpisode.episode_status,
        outcome: 'unmatched',
        workflow_ids: [],
        action_group_id: null,
        space_id: 'my-space',
      },
    ]);
  });

  it('skips writing when the datastream resource is not ready', async () => {
    const { loggerService } = createLoggerService();
    resourceManager.isReady.mockReturnValue(false);
    const step = new StoreExecutionHistoryStep(storageService, resourceManager, loggerService);

    const episode = createAlertEpisode();
    const group = createActionGroup({ episodes: [episode] });
    const state = createDispatcherPipelineState({
      dispatch: [group],
      dispatchable: [episode],
      policies: new Map([['policy-1', createActionPolicy({ id: 'policy-1' })]]),
      rules: new Map<RuleId, Rule>([['rule-1', createRule({ id: 'rule-1' })]]),
    });

    const result = await step.execute(state);

    expect(result).toEqual({ type: 'continue' });
    expect(resourceManager.isReady).toHaveBeenCalledWith(ACTION_POLICY_EXECUTIONS_RESOURCE_KEY);
    expect(storageService.bulkIndexDocs).not.toHaveBeenCalled();
  });

  it('logs and swallows errors from bulkIndexDocs', async () => {
    const { loggerService, mockLogger } = createLoggerService();
    const step = new StoreExecutionHistoryStep(storageService, resourceManager, loggerService);

    storageService.bulkIndexDocs.mockRejectedValueOnce(new Error('boom'));

    const episode = createAlertEpisode();
    const group = createActionGroup({ episodes: [episode] });
    const state = createDispatcherPipelineState({
      dispatch: [group],
      dispatchable: [episode],
      policies: new Map([['policy-1', createActionPolicy({ id: 'policy-1' })]]),
      rules: new Map<RuleId, Rule>([['rule-1', createRule({ id: 'rule-1' })]]),
    });

    const result = await step.execute(state);

    expect(result).toEqual({ type: 'continue' });
    expect(mockLogger.error).toHaveBeenCalledTimes(1);
  });

  it('does not call bulkIndexDocs when all arrays are empty', async () => {
    const { loggerService } = createLoggerService();
    const step = new StoreExecutionHistoryStep(storageService, resourceManager, loggerService);

    const state = createDispatcherPipelineState({
      dispatch: [],
      throttled: [],
      dispatchable: [],
    });

    const result = await step.execute(state);

    expect(result).toEqual({ type: 'continue' });
    expect(storageService.bulkIndexDocs).not.toHaveBeenCalled();
  });

  it('uses input.startedAt as @timestamp for every emitted doc', async () => {
    const { loggerService } = createLoggerService();
    const step = new StoreExecutionHistoryStep(storageService, resourceManager, loggerService);

    const dispatchedEpisode = createAlertEpisode({ episode_id: 'ep-dispatched' });
    const dispatchedGroup = createActionGroup({
      id: 'g-dispatched',
      episodes: [dispatchedEpisode],
    });
    const unmatchedEpisode = createAlertEpisode({ episode_id: 'ep-unmatched' });

    const state = createDispatcherPipelineState({
      dispatch: [dispatchedGroup],
      dispatchable: [dispatchedEpisode, unmatchedEpisode],
      policies: new Map([['policy-1', createActionPolicy({ id: 'policy-1' })]]),
      rules: new Map<RuleId, Rule>([['rule-1', createRule({ id: 'rule-1' })]]),
    });

    await step.execute(state);

    const expected = state.input.startedAt.toISOString();
    const call = storageService.bulkIndexDocs.mock.calls[0][0];
    expect(call.docs.map((doc) => doc['@timestamp'])).toEqual([expected, expected]);
  });

  it('falls back to "unknown" rule/policy names and default space when maps are missing entries', async () => {
    const { loggerService } = createLoggerService();
    const step = new StoreExecutionHistoryStep(storageService, resourceManager, loggerService);

    const episode = createAlertEpisode({ rule_id: 'missing-rule' });
    const group = createActionGroup({ policyId: 'missing-policy', episodes: [episode] });
    const unmatchedEpisode = createAlertEpisode({
      episode_id: 'ep-unmatched',
      rule_id: 'missing-rule',
    });

    const state = createDispatcherPipelineState({
      dispatch: [group],
      dispatchable: [episode, unmatchedEpisode],
      policies: new Map(),
      rules: new Map(),
    });

    await step.execute(state);

    const call = storageService.bulkIndexDocs.mock.calls[0][0];
    const dispatched = call.docs.find((doc) => doc.outcome === 'dispatched');
    const unmatched = call.docs.find((doc) => doc.outcome === 'unmatched');

    expect(dispatched?.action_policy_name).toBe('unknown');
    expect(dispatched?.rule_name).toBe('unknown');
    expect(unmatched?.rule_name).toBe('unknown');
    expect(unmatched?.space_id).toBe('default');
  });
});
