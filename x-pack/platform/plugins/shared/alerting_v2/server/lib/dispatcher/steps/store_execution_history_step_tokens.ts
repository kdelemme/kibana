/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import type { IEventLogger } from '@kbn/event-log-plugin/server';
import type { ServiceIdentifier } from 'inversify';

export const ACTION_POLICY_EVENT_PROVIDER = 'alerting_v2' as const;

export const ACTION_POLICY_EVENT_ACTIONS = {
  DISPATCHED: 'dispatched',
  THROTTLED: 'throttled',
  UNMATCHED: 'unmatched',
} as const;

export type ActionPolicyEventAction =
  (typeof ACTION_POLICY_EVENT_ACTIONS)[keyof typeof ACTION_POLICY_EVENT_ACTIONS];

export const ActionPolicyExecutionEventLoggerToken = Symbol.for(
  'alerting_v2.ActionPolicyExecutionEventLogger'
) as ServiceIdentifier<IEventLogger>;
