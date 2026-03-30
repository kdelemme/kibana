/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { inject, injectable } from 'inversify';
import type {
  LastNotifiedRecord,
  NotificationGroup,
  NotificationGroupId,
  NotificationPolicy,
  DispatcherStep,
  DispatcherPipelineState,
  DispatcherStepOutput,
} from '../types';
import {
  LoggerServiceToken,
  type LoggerServiceContract,
} from '../../services/logger_service/logger_service';
import type { QueryServiceContract } from '../../services/query_service/query_service';
import { QueryServiceInternalToken } from '../../services/query_service/tokens';
import { queryResponseToRecords } from '../../services/query_service/query_response_to_records';
import { getLastNotifiedTimestampsQuery } from '../queries';
import { parseDurationToMs } from '../../duration';

export interface LastNotifiedInfo {
  lastNotified: Date;
  episodeStatus?: string;
}

@injectable()
export class ApplyThrottlingStep implements DispatcherStep {
  public readonly name = 'apply_throttling';

  constructor(
    @inject(QueryServiceInternalToken) private readonly queryService: QueryServiceContract,
    @inject(LoggerServiceToken) private readonly logger: LoggerServiceContract
  ) {}

  public async execute(state: Readonly<DispatcherPipelineState>): Promise<DispatcherStepOutput> {
    const { groups = [], policies = new Map(), input } = state;

    if (groups.length === 0) {
      return { type: 'continue', data: { dispatch: [], throttled: [] } };
    }

    const lastNotifiedMap = await this.fetchLastNotifiedTimestamps(groups.map((g) => g.id));

    const { dispatch, throttled } = applyThrottling(
      groups,
      policies,
      lastNotifiedMap,
      input.startedAt
    );

    this.logger.debug({
      message: () =>
        `Applied throttling to ${throttled.length} groups and dispatched ${dispatch.length} groups`,
    });

    return { type: 'continue', data: { dispatch, throttled } };
  }

  private async fetchLastNotifiedTimestamps(
    notificationGroupIds: NotificationGroupId[]
  ): Promise<Map<NotificationGroupId, LastNotifiedInfo>> {
    const result = await this.queryService.executeQuery({
      query: getLastNotifiedTimestampsQuery(notificationGroupIds).query,
    });

    const records = queryResponseToRecords<LastNotifiedRecord>(result);
    return new Map<NotificationGroupId, LastNotifiedInfo>(
      records.map((record) => [
        record.notification_group_id,
        {
          lastNotified: new Date(record.last_notified),
          episodeStatus: record.episode_status,
        },
      ])
    );
  }
}

export function applyThrottling(
  groups: readonly NotificationGroup[],
  policies: ReadonlyMap<string, NotificationPolicy>,
  lastNotifiedMap: ReadonlyMap<NotificationGroupId, LastNotifiedInfo>,
  now: Date
): { dispatch: NotificationGroup[]; throttled: NotificationGroup[] } {
  const dispatch: NotificationGroup[] = [];
  const throttled: NotificationGroup[] = [];

  for (const group of groups) {
    const policy = policies.get(group.policyId)!;
    const groupingMode = policy.groupingMode ?? 'per_episode';
    const strategy =
      policy.throttle?.strategy ??
      (groupingMode === 'per_episode' ? 'on_status_change' : 'time_interval');
    const lastRecord = lastNotifiedMap.get(group.id);

    if (!lastRecord) {
      dispatch.push(group);
      continue;
    }

    if (strategy === 'every_time') {
      dispatch.push(group);
      continue;
    }

    if (groupingMode === 'per_episode') {
      const currentStatus = group.episodes[0]?.episode_status;
      const statusChanged = lastRecord.episodeStatus !== currentStatus;

      if (strategy === 'on_status_change') {
        if (statusChanged) {
          dispatch.push(group);
        } else {
          throttled.push(group);
        }
      } else if (strategy === 'per_status_interval') {
        if (statusChanged) {
          dispatch.push(group);
        } else if (
          policy.throttle?.interval &&
          !isWithinInterval(lastRecord.lastNotified, policy.throttle.interval, now)
        ) {
          dispatch.push(group);
        } else {
          throttled.push(group);
        }
      }
    } else {
      if (
        policy.throttle?.interval &&
        isWithinInterval(lastRecord.lastNotified, policy.throttle.interval, now)
      ) {
        throttled.push(group);
      } else {
        dispatch.push(group);
      }
    }
  }

  return { dispatch, throttled };
}

function isWithinInterval(lastNotifiedAt: Date, interval: string, now: Date): boolean {
  try {
    const intervalMillis = parseDurationToMs(interval);
    return lastNotifiedAt.getTime() + intervalMillis > now.getTime();
  } catch {
    return false;
  }
}
