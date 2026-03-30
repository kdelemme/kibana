/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { z } from '@kbn/zod/v4';
import { durationSchema } from './common';

const workflowNotificationPolicyDestinationSchema = z.object({
  type: z.literal('workflow'),
  id: z.string(),
});

export const notificationPolicyDestinationSchema = z.discriminatedUnion('type', [
  workflowNotificationPolicyDestinationSchema,
]);

export const groupingModeSchema = z.enum(['per_episode', 'all', 'per_field']);

export type GroupingMode = z.infer<typeof groupingModeSchema>;

export const throttleStrategySchema = z.enum([
  'on_status_change',
  'per_status_interval',
  'time_interval',
  'every_time',
]);

export type ThrottleStrategy = z.infer<typeof throttleStrategySchema>;

const throttleSchema = z.object({
  strategy: throttleStrategySchema.optional(),
  interval: durationSchema.optional(),
});

const PER_EPISODE_STRATEGIES = new Set<string>([
  'on_status_change',
  'per_status_interval',
  'every_time',
]);
const AGGREGATE_STRATEGIES = new Set<string>(['time_interval', 'every_time']);
const STRATEGIES_REQUIRING_INTERVAL = new Set<string>(['per_status_interval', 'time_interval']);

const validateGroupingModeAndStrategy = (
  data: {
    groupingMode?: string | null;
    throttle?: { strategy?: string; interval?: string } | null;
  },
  ctx: z.RefinementCtx
) => {
  const mode = data.groupingMode ?? 'per_episode';
  const strategy = data.throttle?.strategy;
  if (!strategy) return;

  const allowed = mode === 'per_episode' ? PER_EPISODE_STRATEGIES : AGGREGATE_STRATEGIES;
  if (!allowed.has(strategy)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `Strategy "${strategy}" is not valid for grouping mode "${mode}"`,
      path: ['throttle', 'strategy'],
    });
  }

  if (STRATEGIES_REQUIRING_INTERVAL.has(strategy) && !data.throttle?.interval) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `Strategy "${strategy}" requires an interval to be defined`,
      path: ['throttle', 'interval'],
    });
  }
};

export type NotificationPolicyDestination = z.infer<typeof notificationPolicyDestinationSchema>;

export const snoozeNotificationPolicyBodySchema = z.object({
  snoozedUntil: z.string().datetime(),
});

export type SnoozeNotificationPolicyBody = z.infer<typeof snoozeNotificationPolicyBodySchema>;

const bulkEnableActionSchema = z.object({
  id: z.string(),
  action: z.literal('enable'),
});

const bulkDisableActionSchema = z.object({
  id: z.string(),
  action: z.literal('disable'),
});

const bulkSnoozeActionSchema = z.object({
  id: z.string(),
  action: z.literal('snooze'),
  snoozedUntil: z.string().datetime(),
});

const bulkUnsnoozeActionSchema = z.object({
  id: z.string(),
  action: z.literal('unsnooze'),
});

const bulkDeleteActionSchema = z.object({
  id: z.string(),
  action: z.literal('delete'),
});

const bulkUpdateApiKeyActionSchema = z.object({
  id: z.string(),
  action: z.literal('update_api_key'),
});

export const notificationPolicyBulkActionSchema = z.discriminatedUnion('action', [
  bulkEnableActionSchema,
  bulkDisableActionSchema,
  bulkSnoozeActionSchema,
  bulkUnsnoozeActionSchema,
  bulkDeleteActionSchema,
  bulkUpdateApiKeyActionSchema,
]);

export type NotificationPolicyBulkAction = z.infer<typeof notificationPolicyBulkActionSchema>;

export const bulkActionNotificationPoliciesBodySchema = z.object({
  actions: z.array(notificationPolicyBulkActionSchema).min(1, 'At least one action is required'),
});

export type BulkActionNotificationPoliciesBody = z.infer<
  typeof bulkActionNotificationPoliciesBodySchema
>;

export const createNotificationPolicyDataSchema = z
  .object({
    name: z.string(),
    description: z.string(),
    destinations: z
      .array(notificationPolicyDestinationSchema)
      .min(1, 'At least one destination must be provided'),
    matcher: z.string().optional(),
    groupBy: z.array(z.string()).optional(),
    groupingMode: groupingModeSchema.optional(),
    throttle: throttleSchema.optional(),
  })
  .superRefine(validateGroupingModeAndStrategy);

export type CreateNotificationPolicyData = z.infer<typeof createNotificationPolicyDataSchema>;

export const updateNotificationPolicyDataSchema = z
  .object({
    name: z.string().optional(),
    description: z.string().optional(),
    destinations: z
      .array(notificationPolicyDestinationSchema)
      .min(1, 'At least one destination must be provided')
      .optional(),
    matcher: z.string().optional().nullable(),
    groupBy: z.array(z.string()).optional().nullable(),
    groupingMode: groupingModeSchema.optional().nullable(),
    throttle: throttleSchema.optional().nullable(),
  })
  .superRefine((data, ctx) => {
    if (data.throttle === null || data.throttle === undefined) return;
    validateGroupingModeAndStrategy(data, ctx);
  });

export type UpdateNotificationPolicyData = z.infer<typeof updateNotificationPolicyDataSchema>;

export const updateNotificationPolicyBodySchema = updateNotificationPolicyDataSchema.extend({
  version: z.string(),
});

export type UpdateNotificationPolicyBody = z.infer<typeof updateNotificationPolicyBodySchema>;
