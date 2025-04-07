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
 *   title: Execution Summary Schema
 *   version: not applicable
 */

import { z } from '@kbn/zod';

import { RuleExecutionStatus, RuleExecutionStatusOrder } from './execution_status.gen';
import { RuleExecutionMetrics } from './execution_metrics.gen';

/**
  * Summary of the last execution of a rule.
> info
> This field is under development and its usage or schema may change

  */
export type RuleExecutionSummary = z.infer<typeof RuleExecutionSummary>;
export const RuleExecutionSummary = z.object({
  last_execution: z.object({
    /**
     * Date of the last execution
     */
    date: z.string().datetime(),
    /**
     * Status of the last execution
     */
    status: RuleExecutionStatus,
    status_order: RuleExecutionStatusOrder,
    message: z.string(),
    metrics: RuleExecutionMetrics,
  }),
});
