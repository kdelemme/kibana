/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { inject, injectable } from 'inversify';
import {
  ACTION_POLICY_EXECUTIONS_DATA_STREAM,
  ACTION_POLICY_EXECUTIONS_RESOURCE_KEY,
  type ActionPolicyExecution,
  type ActionPolicyExecutionOutcome,
} from '../../../resources/datastreams/action_policy_executions';
import {
  LoggerServiceToken,
  type LoggerServiceContract,
} from '../../services/logger_service/logger_service';
import {
  ResourceManager,
  type ResourceManagerContract,
} from '../../services/resource_service/resource_manager';
import type { StorageServiceContract } from '../../services/storage_service/storage_service';
import { StorageServiceInternalToken } from '../../services/storage_service/tokens';
import type {
  ActionGroup,
  ActionPolicy,
  AlertEpisode,
  DispatcherPipelineState,
  DispatcherStep,
  DispatcherStepOutput,
  Rule,
  RuleId,
} from '../types';

@injectable()
export class StoreExecutionHistoryStep implements DispatcherStep {
  public readonly name = 'store_execution_history';

  constructor(
    @inject(StorageServiceInternalToken)
    private readonly storageService: StorageServiceContract,
    @inject(ResourceManager)
    private readonly resourceManager: ResourceManagerContract,
    @inject(LoggerServiceToken)
    private readonly logger: LoggerServiceContract
  ) {}

  public async execute(state: Readonly<DispatcherPipelineState>): Promise<DispatcherStepOutput> {
    if (!this.resourceManager.isReady(ACTION_POLICY_EXECUTIONS_RESOURCE_KEY)) {
      return { type: 'continue' };
    }

    const { dispatch = [], throttled = [], dispatchable = [], policies, rules, input } = state;

    if (dispatch.length === 0 && throttled.length === 0 && dispatchable.length === 0) {
      return { type: 'continue' };
    }

    const timestamp = input.startedAt.toISOString();
    const docs: ActionPolicyExecution[] = [];

    for (const group of dispatch) {
      const policy = policies?.get(group.policyId);
      for (const episode of group.episodes) {
        docs.push(toExecution({ timestamp, episode, group, policy, rules, outcome: 'dispatched' }));
      }
    }

    for (const group of throttled) {
      const policy = policies?.get(group.policyId);
      for (const episode of group.episodes) {
        docs.push(toExecution({ timestamp, episode, group, policy, rules, outcome: 'throttled' }));
      }
    }

    const unmatched = getUnmatchedEpisodes(dispatchable, dispatch, throttled);
    for (const episode of unmatched) {
      const rule = rules?.get(episode.rule_id);
      docs.push({
        '@timestamp': timestamp,
        action_policy_id: null,
        action_policy_name: null,
        rule_id: episode.rule_id,
        rule_name: rule?.name ?? 'unknown',
        group_hash: episode.group_hash,
        episode_id: episode.episode_id,
        episode_status: episode.episode_status,
        outcome: 'unmatched',
        workflow_ids: [],
        action_group_id: null,
        space_id: rule?.spaceId ?? 'default',
      });
    }

    if (docs.length === 0) {
      return { type: 'continue' };
    }

    try {
      await this.storageService.bulkIndexDocs<ActionPolicyExecution>({
        index: ACTION_POLICY_EXECUTIONS_DATA_STREAM,
        docs,
      });
    } catch (error) {
      this.logger.error({
        error: error instanceof Error ? error : new Error(String(error)),
        code: 'ACTION_POLICY_EXECUTION_HISTORY_WRITE_FAILED',
        type: 'ActionPolicyExecutionHistoryWriteFailed',
      });
    }

    return { type: 'continue' };
  }
}

function toExecution({
  timestamp,
  episode,
  group,
  policy,
  rules,
  outcome,
}: {
  timestamp: string;
  episode: AlertEpisode;
  group: ActionGroup;
  policy: ActionPolicy | undefined;
  rules: Map<RuleId, Rule> | undefined;
  outcome: Exclude<ActionPolicyExecutionOutcome, 'unmatched'>;
}): ActionPolicyExecution {
  const rule = rules?.get(episode.rule_id);
  return {
    '@timestamp': timestamp,
    action_policy_id: group.policyId,
    action_policy_name: policy?.name ?? 'unknown',
    rule_id: episode.rule_id,
    rule_name: rule?.name ?? 'unknown',
    group_hash: episode.group_hash,
    episode_id: episode.episode_id,
    episode_status: episode.episode_status,
    outcome,
    workflow_ids: group.destinations.map((destination) => destination.id),
    action_group_id: group.id,
    space_id: group.spaceId,
  };
}

function getUnmatchedEpisodes(
  dispatchable: readonly AlertEpisode[],
  dispatch: readonly ActionGroup[],
  throttled: readonly ActionGroup[]
): AlertEpisode[] {
  const handledEpisodeKeys = new Set<string>();
  for (const group of [...dispatch, ...throttled]) {
    for (const episode of group.episodes) {
      handledEpisodeKeys.add(`${episode.rule_id}:${episode.group_hash}:${episode.episode_id}`);
    }
  }

  return dispatchable.filter(
    (ep) => !handledEpisodeKeys.has(`${ep.rule_id}:${ep.group_hash}:${ep.episode_id}`)
  );
}
