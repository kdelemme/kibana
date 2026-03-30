/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { applyThrottling, type LastNotifiedInfo } from './apply_throttling_step';
import {
  createAlertEpisode,
  createNotificationGroup,
  createNotificationPolicy,
} from '../fixtures/test_utils';
import type { NotificationGroupId } from '../types';

const info = (lastNotified: string, episodeStatus?: string): LastNotifiedInfo => ({
  lastNotified: new Date(lastNotified),
  episodeStatus,
});

describe('applyThrottling', () => {
  describe('default behavior (per_episode + on_status_change)', () => {
    it('dispatches group when no previous notification exists', () => {
      const group = createNotificationGroup({ id: 'g1', policyId: 'p1' });
      const policy = createNotificationPolicy({ id: 'p1' });

      const { dispatch, throttled } = applyThrottling(
        [group],
        new Map([['p1', policy]]),
        new Map(),
        new Date('2026-01-22T10:00:00.000Z')
      );

      expect(dispatch).toHaveLength(1);
      expect(throttled).toHaveLength(0);
    });

    it('dispatches when episode status differs from last-notified status', () => {
      const group = createNotificationGroup({
        id: 'g1',
        policyId: 'p1',
        episodes: [createAlertEpisode({ episode_status: 'recovering' })],
      });
      const policy = createNotificationPolicy({ id: 'p1' });

      const { dispatch, throttled } = applyThrottling(
        [group],
        new Map([['p1', policy]]),
        new Map<NotificationGroupId, LastNotifiedInfo>([
          ['g1', info('2026-01-22T09:59:00.000Z', 'active')],
        ]),
        new Date('2026-01-22T10:00:00.000Z')
      );

      expect(dispatch).toHaveLength(1);
      expect(throttled).toHaveLength(0);
    });

    it('throttles when episode status is the same as last-notified status', () => {
      const group = createNotificationGroup({
        id: 'g1',
        policyId: 'p1',
        episodes: [createAlertEpisode({ episode_status: 'active' })],
      });
      const policy = createNotificationPolicy({ id: 'p1' });

      const { dispatch, throttled } = applyThrottling(
        [group],
        new Map([['p1', policy]]),
        new Map<NotificationGroupId, LastNotifiedInfo>([
          ['g1', info('2026-01-22T09:59:00.000Z', 'active')],
        ]),
        new Date('2026-01-22T10:00:00.000Z')
      );

      expect(dispatch).toHaveLength(0);
      expect(throttled).toHaveLength(1);
    });
  });

  describe('on_status_change strategy', () => {
    it('dispatches when status changed even within throttle interval', () => {
      const group = createNotificationGroup({
        id: 'g1',
        policyId: 'p1',
        episodes: [createAlertEpisode({ episode_status: 'inactive' })],
      });
      const policy = createNotificationPolicy({
        id: 'p1',
        throttle: { strategy: 'on_status_change', interval: '1h' },
      });

      const { dispatch, throttled } = applyThrottling(
        [group],
        new Map([['p1', policy]]),
        new Map<NotificationGroupId, LastNotifiedInfo>([
          ['g1', info('2026-01-22T09:59:00.000Z', 'active')],
        ]),
        new Date('2026-01-22T10:00:00.000Z')
      );

      expect(dispatch).toHaveLength(1);
      expect(throttled).toHaveLength(0);
    });
  });

  describe('per_status_interval strategy', () => {
    it('dispatches on status change regardless of interval', () => {
      const group = createNotificationGroup({
        id: 'g1',
        policyId: 'p1',
        episodes: [createAlertEpisode({ episode_status: 'recovering' })],
      });
      const policy = createNotificationPolicy({
        id: 'p1',
        throttle: { strategy: 'per_status_interval', interval: '1h' },
      });

      const { dispatch, throttled } = applyThrottling(
        [group],
        new Map([['p1', policy]]),
        new Map<NotificationGroupId, LastNotifiedInfo>([
          ['g1', info('2026-01-22T09:59:00.000Z', 'active')],
        ]),
        new Date('2026-01-22T10:00:00.000Z')
      );

      expect(dispatch).toHaveLength(1);
      expect(throttled).toHaveLength(0);
    });

    it('dispatches when same status but interval expired', () => {
      const group = createNotificationGroup({
        id: 'g1',
        policyId: 'p1',
        episodes: [createAlertEpisode({ episode_status: 'active' })],
      });
      const policy = createNotificationPolicy({
        id: 'p1',
        throttle: { strategy: 'per_status_interval', interval: '1h' },
      });

      const { dispatch, throttled } = applyThrottling(
        [group],
        new Map([['p1', policy]]),
        new Map<NotificationGroupId, LastNotifiedInfo>([
          ['g1', info('2026-01-22T08:00:00.000Z', 'active')],
        ]),
        new Date('2026-01-22T10:00:00.000Z')
      );

      expect(dispatch).toHaveLength(1);
      expect(throttled).toHaveLength(0);
    });

    it('throttles when same status and within interval', () => {
      const group = createNotificationGroup({
        id: 'g1',
        policyId: 'p1',
        episodes: [createAlertEpisode({ episode_status: 'active' })],
      });
      const policy = createNotificationPolicy({
        id: 'p1',
        throttle: { strategy: 'per_status_interval', interval: '1h' },
      });

      const { dispatch, throttled } = applyThrottling(
        [group],
        new Map([['p1', policy]]),
        new Map<NotificationGroupId, LastNotifiedInfo>([
          ['g1', info('2026-01-22T09:30:00.000Z', 'active')],
        ]),
        new Date('2026-01-22T10:00:00.000Z')
      );

      expect(dispatch).toHaveLength(0);
      expect(throttled).toHaveLength(1);
    });
  });

  describe('every_time strategy', () => {
    it('always dispatches even with recent notification', () => {
      const group = createNotificationGroup({
        id: 'g1',
        policyId: 'p1',
        episodes: [createAlertEpisode({ episode_status: 'active' })],
      });
      const policy = createNotificationPolicy({
        id: 'p1',
        throttle: { strategy: 'every_time' },
      });

      const { dispatch, throttled } = applyThrottling(
        [group],
        new Map([['p1', policy]]),
        new Map<NotificationGroupId, LastNotifiedInfo>([
          ['g1', info('2026-01-22T09:59:59.000Z', 'active')],
        ]),
        new Date('2026-01-22T10:00:00.000Z')
      );

      expect(dispatch).toHaveLength(1);
      expect(throttled).toHaveLength(0);
    });
  });

  describe('time_interval strategy (all / per_field modes)', () => {
    it('dispatches when interval expired for all mode', () => {
      const group = createNotificationGroup({ id: 'g1', policyId: 'p1' });
      const policy = createNotificationPolicy({
        id: 'p1',
        groupingMode: 'all',
        throttle: { strategy: 'time_interval', interval: '5m' },
      });

      const { dispatch, throttled } = applyThrottling(
        [group],
        new Map([['p1', policy]]),
        new Map<NotificationGroupId, LastNotifiedInfo>([['g1', info('2026-01-22T09:50:00.000Z')]]),
        new Date('2026-01-22T10:00:00.000Z')
      );

      expect(dispatch).toHaveLength(1);
      expect(throttled).toHaveLength(0);
    });

    it('throttles when within interval for per_field mode', () => {
      const group = createNotificationGroup({ id: 'g1', policyId: 'p1' });
      const policy = createNotificationPolicy({
        id: 'p1',
        groupingMode: 'per_field',
        groupBy: ['host.name'],
        throttle: { strategy: 'time_interval', interval: '1h' },
      });

      const { dispatch, throttled } = applyThrottling(
        [group],
        new Map([['p1', policy]]),
        new Map<NotificationGroupId, LastNotifiedInfo>([['g1', info('2026-01-22T09:30:00.000Z')]]),
        new Date('2026-01-22T10:00:00.000Z')
      );

      expect(dispatch).toHaveLength(0);
      expect(throttled).toHaveLength(1);
    });

    it('dispatches when no interval configured for all mode', () => {
      const group = createNotificationGroup({ id: 'g1', policyId: 'p1' });
      const policy = createNotificationPolicy({
        id: 'p1',
        groupingMode: 'all',
        throttle: { strategy: 'time_interval' },
      });

      const { dispatch, throttled } = applyThrottling(
        [group],
        new Map([['p1', policy]]),
        new Map<NotificationGroupId, LastNotifiedInfo>([['g1', info('2026-01-22T09:59:59.000Z')]]),
        new Date('2026-01-22T10:00:00.000Z')
      );

      expect(dispatch).toHaveLength(1);
      expect(throttled).toHaveLength(0);
    });
  });

  describe('mixed groups', () => {
    it('handles mixed dispatch and throttle across groups', () => {
      const g1 = createNotificationGroup({
        id: 'g1',
        policyId: 'p1',
        episodes: [createAlertEpisode({ episode_status: 'active' })],
      });
      const g2 = createNotificationGroup({
        id: 'g2',
        policyId: 'p1',
        episodes: [createAlertEpisode({ episode_status: 'recovering' })],
      });
      const policy = createNotificationPolicy({
        id: 'p1',
        throttle: { strategy: 'on_status_change' },
      });

      const { dispatch, throttled } = applyThrottling(
        [g1, g2],
        new Map([['p1', policy]]),
        new Map<NotificationGroupId, LastNotifiedInfo>([
          ['g1', info('2026-01-22T09:30:00.000Z', 'active')],
          ['g2', info('2026-01-22T09:30:00.000Z', 'active')],
        ]),
        new Date('2026-01-22T10:00:00.000Z')
      );

      expect(dispatch).toHaveLength(1);
      expect(dispatch[0].id).toBe('g2');
      expect(throttled).toHaveLength(1);
      expect(throttled[0].id).toBe('g1');
    });

    it('returns empty arrays when no groups', () => {
      const { dispatch, throttled } = applyThrottling([], new Map(), new Map(), new Date());

      expect(dispatch).toHaveLength(0);
      expect(throttled).toHaveLength(0);
    });
  });
});
