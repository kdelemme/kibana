/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import type { IlmPolicy } from '@elastic/elasticsearch/lib/api/types';
import type { MappingsDefinition } from '@kbn/es-mappings';
import { z } from '@kbn/zod/v4';
import type { ResourceDefinition } from './types';

export const ACTION_POLICY_EXECUTIONS_DATA_STREAM = '.action-policy-executions';
export const ACTION_POLICY_EXECUTIONS_DATA_STREAM_VERSION = 1;
export const ACTION_POLICY_EXECUTIONS_BACKING_INDEX = '.ds-.action-policy-executions-*';
export const ACTION_POLICY_EXECUTIONS_ILM_POLICY_NAME = '.action-policy-executions-ilm-policy';
export const ACTION_POLICY_EXECUTIONS_RESOURCE_KEY = `data_stream:${ACTION_POLICY_EXECUTIONS_DATA_STREAM}`;

export const ACTION_POLICY_EXECUTIONS_ILM_POLICY: IlmPolicy = {
  _meta: { managed: true },
  phases: {
    hot: {
      actions: {
        rollover: {
          max_age: '30d',
          max_primary_shard_size: '50gb',
        },
      },
    },
    delete: {
      min_age: '30d',
      actions: { delete: {} },
    },
  },
};

const mappings: MappingsDefinition = {
  dynamic: false,
  properties: {
    '@timestamp': { type: 'date' },
    action_policy_id: { type: 'keyword' },
    action_policy_name: { type: 'keyword' },
    rule_id: { type: 'keyword' },
    rule_name: { type: 'keyword' },
    group_hash: { type: 'keyword' },
    episode_id: { type: 'keyword' },
    episode_status: { type: 'keyword' },
    outcome: { type: 'keyword' },
    workflow_ids: { type: 'keyword' },
    action_group_id: { type: 'keyword' },
    space_id: { type: 'keyword' },
  },
};

export const actionPolicyExecutionSchema = z.object({
  '@timestamp': z.string(),
  action_policy_id: z.string().nullable(),
  action_policy_name: z.string().nullable(),
  rule_id: z.string(),
  rule_name: z.string(),
  group_hash: z.string(),
  episode_id: z.string(),
  episode_status: z.string(),
  outcome: z.enum(['dispatched', 'throttled', 'unmatched']),
  workflow_ids: z.array(z.string()),
  action_group_id: z.string().nullable(),
  space_id: z.string(),
});

export type ActionPolicyExecution = z.infer<typeof actionPolicyExecutionSchema>;
export type ActionPolicyExecutionOutcome = ActionPolicyExecution['outcome'];

export const getActionPolicyExecutionsResourceDefinition = (): ResourceDefinition => ({
  key: ACTION_POLICY_EXECUTIONS_RESOURCE_KEY,
  dataStreamName: ACTION_POLICY_EXECUTIONS_DATA_STREAM,
  version: ACTION_POLICY_EXECUTIONS_DATA_STREAM_VERSION,
  mappings,
  ilmPolicy: {
    name: ACTION_POLICY_EXECUTIONS_ILM_POLICY_NAME,
    policy: ACTION_POLICY_EXECUTIONS_ILM_POLICY,
  },
});
