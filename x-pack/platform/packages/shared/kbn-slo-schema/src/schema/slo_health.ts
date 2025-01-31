/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import * as t from 'io-ts';
import { sloIdSchema, tagsSchema } from './slo';

const sloHealthStatusSchema = t.union([
  t.literal('healthy'),
  t.literal('degraded'),
  t.literal('failed'),
]);

const transformHealthStatusSchema = t.union([
  t.literal('green'),
  t.literal('yellow'),
  t.literal('red'),
  t.literal('unknown'),
]);

const transformIssueSchema = t.type({
  issue: t.string,
  details: t.union([t.string, t.undefined]),
  count: t.number,
  firstOccurrence: t.union([t.string, t.undefined]),
});

const transformHealthSchema = t.type({
  status: transformHealthStatusSchema,
  issues: t.array(transformIssueSchema),
});

const transformStatsStateSchema = t.union([
  t.literal('started'),
  t.literal('stopped'),
  t.literal('stopping'),
  t.literal('indexing'),
  t.literal('failed'),
  t.literal('aborting'),
]);

const transformStatsSchema = t.type({
  id: t.string,
  state: transformStatsStateSchema,
  reason: t.union([t.string, t.undefined]),
  health: transformHealthSchema,
});

const sloHealthSchema = t.type({
  id: sloIdSchema,
  name: t.string,
  description: t.string,
  tags: tagsSchema,
  revision: t.number,
  version: t.number,
  spaceId: t.string,
  instances: t.union([t.number, t.undefined]),
  createdAt: t.string,
  status: sloHealthStatusSchema,
  health: t.type({
    rollupTransform: sloHealthStatusSchema,
    summaryTransform: sloHealthStatusSchema,
    delay: sloHealthStatusSchema,
    staleTime: sloHealthStatusSchema,
    version: sloHealthStatusSchema,
  }),
  data: t.type({
    summaryUpdatedAt: t.string,
    lastRollupIngestedAt: t.string,
    delay: t.number,
    staleTime: t.number,
    summaryTransform: transformStatsSchema,
    rollupTransform: transformStatsSchema,
  }),
});

export {
  sloHealthSchema,
  sloHealthStatusSchema,
  transformHealthSchema,
  transformHealthStatusSchema,
  transformIssueSchema,
  transformStatsSchema,
};

type TransformStatsState = t.TypeOf<typeof transformStatsStateSchema>;
type TransformHealthStatus = t.TypeOf<typeof transformHealthStatusSchema>;
type TransformStats = t.TypeOf<typeof transformStatsSchema>;
type SLOHealthStatus = t.TypeOf<typeof sloHealthStatusSchema>;
export type { TransformHealthStatus, TransformStats, TransformStatsState, SLOHealthStatus };
