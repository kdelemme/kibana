/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

/*
 * NOTICE: Do not edit this file manually.
 * This file is automatically generated by the OpenAPI Generator, @kbn/openapi-generator.
 *
 * info:
 *   title: Set alerts status API endpoint
 *   version: 2023-10-31
 */

import { z } from '@kbn/zod';
import { isNonEmptyString } from '@kbn/zod-helpers';

import { AlertStatus } from '../../../model/alert.gen';

export type SetAlertsStatusByIds = z.infer<typeof SetAlertsStatusByIds>;
export const SetAlertsStatusByIds = z.object({
  /**
   * List of alert `id`s.
   */
  signal_ids: z.array(z.string().min(1).superRefine(isNonEmptyString)).min(1),
  status: AlertStatus,
});

export type SetAlertsStatusByQuery = z.infer<typeof SetAlertsStatusByQuery>;
export const SetAlertsStatusByQuery = z.object({
  query: z.object({}).catchall(z.unknown()),
  status: AlertStatus,
  conflicts: z.enum(['abort', 'proceed']).optional().default('abort'),
});

export type SetAlertsStatusRequestBody = z.infer<typeof SetAlertsStatusRequestBody>;
export const SetAlertsStatusRequestBody = z.union([SetAlertsStatusByIds, SetAlertsStatusByQuery]);
export type SetAlertsStatusRequestBodyInput = z.input<typeof SetAlertsStatusRequestBody>;

/**
 * Elasticsearch update by query response
 */
export type SetAlertsStatusResponse = z.infer<typeof SetAlertsStatusResponse>;
export const SetAlertsStatusResponse = z.object({}).catchall(z.unknown());
