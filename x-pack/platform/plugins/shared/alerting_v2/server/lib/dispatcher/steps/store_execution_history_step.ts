/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { inject, injectable } from 'inversify';
import type { IEvent, IEventLogger } from '@kbn/event-log-plugin/server';
import { SAVED_OBJECT_REL_PRIMARY } from '@kbn/event-log-plugin/server';
import { ACTION_POLICY_SAVED_OBJECT_TYPE, RULE_SAVED_OBJECT_TYPE } from '../../../saved_objects';
import type {
  ActionGroup,
  ActionPolicyId,
  AlertEpisode,
  DispatcherPipelineState,
  DispatcherStep,
  DispatcherStepOutput,
  Rule,
  RuleId,
} from '../types';
import {
  ACTION_POLICY_EVENT_ACTIONS,
  ActionPolicyExecutionEventLoggerToken,
  type ActionPolicyEventAction,
} from './store_execution_history_step_tokens';

const RULE_REF_CAP = 50;

interface SavedObjectRef {
  type: string;
  type_id?: string;
  id: string;
  rel: typeof SAVED_OBJECT_REL_PRIMARY;
  namespace?: string;
}

interface PolicySummary {
  policyId: ActionPolicyId;
  spaceId: string;
  episodeIds: Set<string>;
  ruleIds: Set<RuleId>;
  actionGroupIds: Set<string>;
  workflowIds: Set<string>;
}

interface PolicySummaryAlertingV2Fields {
  episode_count: number;
  episode_ids: string[];
  rule_count: number;
  rule_ids?: string[];
  action_group_count: number;
  action_group_ids: string[];
  workflow_ids: string[];
}

interface UnmatchedAlertingV2Fields {
  episode_count: number;
  episode_ids: string[];
}

@injectable()
export class StoreExecutionHistoryStep implements DispatcherStep {
  public readonly name = 'store_execution_history';

  constructor(
    @inject(ActionPolicyExecutionEventLoggerToken)
    private readonly eventLogger: IEventLogger
  ) {}

  public async execute(state: Readonly<DispatcherPipelineState>): Promise<DispatcherStepOutput> {
    const { dispatch = [], throttled = [], dispatchable = [], rules, input } = state;

    if (dispatch.length === 0 && throttled.length === 0 && dispatchable.length === 0) {
      return { type: 'continue' };
    }

    const timestamp = input.startedAt.toISOString();

    for (const summary of aggregateByPolicy(dispatch).values()) {
      this.emitPolicySummary({
        timestamp,
        summary,
        action: ACTION_POLICY_EVENT_ACTIONS.DISPATCHED,
        rules,
      });
    }

    for (const summary of aggregateByPolicy(throttled).values()) {
      this.emitPolicySummary({
        timestamp,
        summary,
        action: ACTION_POLICY_EVENT_ACTIONS.THROTTLED,
        rules,
      });
    }

    const unmatchedByRule = aggregateUnmatchedByRule(
      getUnmatchedEpisodes(dispatchable, dispatch, throttled)
    );
    for (const [ruleId, episodeIds] of unmatchedByRule) {
      const rule = rules?.get(ruleId);
      this.eventLogger.logEvent(
        buildEvent<UnmatchedAlertingV2Fields>({
          timestamp,
          action: ACTION_POLICY_EVENT_ACTIONS.UNMATCHED,
          spaceId: rule?.spaceId ?? 'default',
          savedObjects: [ruleRef({ id: ruleId, spaceId: rule?.spaceId, kind: rule?.kind })],
          alertingV2: {
            episode_count: episodeIds.size,
            episode_ids: Array.from(episodeIds),
          },
        })
      );
    }

    return { type: 'continue' };
  }

  private emitPolicySummary({
    timestamp,
    summary,
    action,
    rules,
  }: {
    timestamp: string;
    summary: PolicySummary;
    action: ActionPolicyEventAction;
    rules: Map<RuleId, Rule> | undefined;
  }): void {
    const ruleIds = Array.from(summary.ruleIds);
    const capped = ruleIds.slice(0, RULE_REF_CAP);
    const spillOver = ruleIds.slice(RULE_REF_CAP);

    const refs: SavedObjectRef[] = [
      policyRef({ id: summary.policyId, spaceId: summary.spaceId }),
      ...capped.map((id) => {
        const rule = rules?.get(id);
        return ruleRef({
          id,
          spaceId: rule?.spaceId ?? summary.spaceId,
          kind: rule?.kind,
        });
      }),
    ];

    this.eventLogger.logEvent(
      buildEvent<PolicySummaryAlertingV2Fields>({
        timestamp,
        action,
        spaceId: summary.spaceId,
        savedObjects: refs,
        alertingV2: {
          episode_count: summary.episodeIds.size,
          episode_ids: Array.from(summary.episodeIds),
          rule_count: summary.ruleIds.size,
          ...(spillOver.length > 0 ? { rule_ids: spillOver } : {}),
          action_group_count: summary.actionGroupIds.size,
          action_group_ids: Array.from(summary.actionGroupIds),
          workflow_ids: Array.from(summary.workflowIds),
        },
      })
    );
  }
}

function aggregateByPolicy(groups: readonly ActionGroup[]): Map<ActionPolicyId, PolicySummary> {
  const summaries = new Map<ActionPolicyId, PolicySummary>();
  for (const group of groups) {
    let summary = summaries.get(group.policyId);
    if (!summary) {
      summary = {
        policyId: group.policyId,
        spaceId: group.spaceId,
        episodeIds: new Set(),
        ruleIds: new Set(),
        actionGroupIds: new Set(),
        workflowIds: new Set(),
      };
      summaries.set(group.policyId, summary);
    }
    summary.actionGroupIds.add(group.id);
    for (const destination of group.destinations) {
      summary.workflowIds.add(destination.id);
    }
    for (const episode of group.episodes) {
      summary.episodeIds.add(episode.episode_id);
      summary.ruleIds.add(episode.rule_id);
    }
  }
  return summaries;
}

function aggregateUnmatchedByRule(unmatched: readonly AlertEpisode[]): Map<RuleId, Set<string>> {
  const byRule = new Map<RuleId, Set<string>>();
  for (const episode of unmatched) {
    let ids = byRule.get(episode.rule_id);
    if (!ids) {
      ids = new Set();
      byRule.set(episode.rule_id, ids);
    }
    ids.add(episode.episode_id);
  }
  return byRule;
}

function getUnmatchedEpisodes(
  dispatchable: readonly AlertEpisode[],
  dispatch: readonly ActionGroup[],
  throttled: readonly ActionGroup[]
): AlertEpisode[] {
  const handled = new Set<string>();
  for (const group of [...dispatch, ...throttled]) {
    for (const ep of group.episodes) {
      handled.add(`${ep.rule_id}:${ep.group_hash}:${ep.episode_id}`);
    }
  }
  return dispatchable.filter(
    (ep) => !handled.has(`${ep.rule_id}:${ep.group_hash}:${ep.episode_id}`)
  );
}

function ruleRef({
  id,
  spaceId,
  kind,
}: {
  id: string;
  spaceId: string | undefined;
  kind: Rule['kind'] | undefined;
}): SavedObjectRef {
  return {
    type: RULE_SAVED_OBJECT_TYPE,
    type_id: kind,
    id,
    rel: SAVED_OBJECT_REL_PRIMARY,
    namespace: spaceId === 'default' ? undefined : spaceId,
  };
}

function policyRef({ id, spaceId }: { id: string; spaceId: string }): SavedObjectRef {
  return {
    type: ACTION_POLICY_SAVED_OBJECT_TYPE,
    id,
    rel: SAVED_OBJECT_REL_PRIMARY,
    namespace: spaceId === 'default' ? undefined : spaceId,
  };
}

function buildEvent<T extends PolicySummaryAlertingV2Fields | UnmatchedAlertingV2Fields>({
  timestamp,
  action,
  spaceId,
  savedObjects,
  alertingV2,
}: {
  timestamp: string;
  action: ActionPolicyEventAction;
  spaceId: string;
  savedObjects: SavedObjectRef[];
  alertingV2: T;
}): IEvent {
  return {
    '@timestamp': timestamp,
    event: {
      action,
    },
    kibana: {
      saved_objects: savedObjects,
      space_ids: [spaceId],
      alerting_v2: alertingV2,
    },
  };
}
