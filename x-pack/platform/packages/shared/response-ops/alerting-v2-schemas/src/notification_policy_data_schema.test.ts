/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import {
  bulkActionNotificationPoliciesBodySchema,
  updateNotificationPolicyDataSchema,
} from './notification_policy_data_schema';

describe('bulkActionNotificationPoliciesBodySchema', () => {
  it('accepts a delete action', () => {
    const result = bulkActionNotificationPoliciesBodySchema.parse({
      actions: [{ id: 'policy-1', action: 'delete' }],
    });

    expect(result).toEqual({
      actions: [{ id: 'policy-1', action: 'delete' }],
    });
  });

  it('accepts mixed actions including delete', () => {
    const result = bulkActionNotificationPoliciesBodySchema.parse({
      actions: [
        { id: 'policy-1', action: 'enable' },
        { id: 'policy-2', action: 'disable' },
        { id: 'policy-3', action: 'delete' },
        { id: 'policy-4', action: 'snooze', snoozedUntil: '2026-04-01T10:00:00Z' },
        { id: 'policy-5', action: 'unsnooze' },
      ],
    });

    expect(result.actions).toHaveLength(5);
    expect(result.actions[2]).toEqual({ id: 'policy-3', action: 'delete' });
  });

  it('rejects an unknown action', () => {
    expect(() =>
      bulkActionNotificationPoliciesBodySchema.parse({
        actions: [{ id: 'policy-1', action: 'unknown' }],
      })
    ).toThrow();
  });

  it('rejects an empty actions array', () => {
    expect(() =>
      bulkActionNotificationPoliciesBodySchema.parse({
        actions: [],
      })
    ).toThrow();
  });
});

describe('updateNotificationPolicyDataSchema', () => {
  it('accepts updating throttle strategy without groupingMode', () => {
    const result = updateNotificationPolicyDataSchema.parse({
      throttle: { strategy: 'time_interval', interval: '5m' },
    });

    expect(result.throttle).toEqual({ strategy: 'time_interval', interval: '5m' });
  });

  it('rejects invalid strategy when groupingMode is provided', () => {
    expect(() =>
      updateNotificationPolicyDataSchema.parse({
        groupingMode: 'per_episode',
        throttle: { strategy: 'time_interval', interval: '5m' },
      })
    ).toThrow('not valid for grouping mode');
  });

  it('accepts valid strategy when groupingMode is provided', () => {
    const result = updateNotificationPolicyDataSchema.parse({
      groupingMode: 'all',
      throttle: { strategy: 'time_interval', interval: '5m' },
    });

    expect(result.groupingMode).toBe('all');
    expect(result.throttle).toEqual({ strategy: 'time_interval', interval: '5m' });
  });
});
