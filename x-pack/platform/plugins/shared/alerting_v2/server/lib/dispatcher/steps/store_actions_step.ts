/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { inject, injectable } from 'inversify';
import { ALERT_ACTIONS_DATA_STREAM, type AlertAction } from '../../../resources/alert_actions';
import type {
  AlertEpisode,
  DispatcherStep,
  DispatcherPipelineState,
  DispatcherStepOutput,
} from '../types';
import type { StorageServiceContract } from '../../services/storage_service/storage_service';
import { StorageServiceInternalToken } from '../../services/storage_service/tokens';

@injectable()
export class StoreActionsStep implements DispatcherStep {
  public readonly name = 'record_actions';

  constructor(
    @inject(StorageServiceInternalToken) private readonly storageService: StorageServiceContract
  ) {}

  public async execute(state: Readonly<DispatcherPipelineState>): Promise<DispatcherStepOutput> {
    const { suppressed = [], throttled = [], dispatch = [], dispatchable = [] } = state;

    if (
      suppressed.length === 0 &&
      throttled.length === 0 &&
      dispatch.length === 0 &&
      dispatchable.length === 0
    ) {
      return { type: 'halt', reason: 'no_actions' };
    }

    const now = new Date();

    const suppressedEpisodeKeys = new Set(suppressed.map(toEpisodeKey));
    const throttledEpisodeKeys = new Set(throttled.flatMap((g) => g.episodes.map(toEpisodeKey)));
    const dispatchedEpisodeKeys = new Set(dispatch.flatMap((g) => g.episodes.map(toEpisodeKey)));

    await this.storageService.bulkIndexDocs<AlertAction>({
      index: ALERT_ACTIONS_DATA_STREAM,
      docs: [
        ...dispatchable
          .filter((episode) => {
            const key = toEpisodeKey(episode);
            return (
              !suppressedEpisodeKeys.has(key) &&
              !throttledEpisodeKeys.has(key) &&
              !dispatchedEpisodeKeys.has(key)
            );
          })
          .map((episode) =>
            toAction({ episode, actionType: 'no_op', now, reason: 'no action taken' })
          ),
        ...suppressed.map((episode) =>
          toAction({ episode, actionType: 'suppress', now, reason: episode.reason })
        ),
        ...throttled.flatMap((group) =>
          group.episodes.map((episode) =>
            toAction({
              episode,
              actionType: 'suppress',
              now,
              reason: `suppressed by throttled policy ${group.policyId}`,
            })
          )
        ),
        ...dispatch.flatMap((group) =>
          group.episodes.map((episode) =>
            toAction({
              episode,
              actionType: 'fire',
              now,
              reason: `dispatched by policy ${group.policyId}`,
            })
          )
        ),
        ...dispatch.map((group) => ({
          '@timestamp': now.toISOString(),
          actor: 'system',
          action_type: 'notified',
          rule_id: group.ruleId,
          group_hash: 'irrelevant',
          last_series_event_timestamp: now.toISOString(),
          notification_group_id: group.id,
          source: 'internal',
          reason: `notified by policy ${group.policyId} with throttle interval`,
        })),
      ],
    });

    return { type: 'continue' };
  }
}

function toAction({
  episode,
  actionType,
  now,
  reason,
}: {
  episode: AlertEpisode;
  actionType: 'suppress' | 'fire' | 'notified' | 'no_op';
  now: Date;
  reason?: string;
}): AlertAction {
  return {
    '@timestamp': now.toISOString(),
    group_hash: episode.group_hash,
    last_series_event_timestamp: episode.last_event_timestamp,
    actor: 'system',
    action_type: actionType,
    rule_id: episode.rule_id,
    source: 'internal',
    reason,
  };
}

function toEpisodeKey(episode: AlertEpisode): string {
  return `${episode.rule_id}:${episode.group_hash}:${episode.episode_id}`;
}
