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
 *   title: Actions List Schema
 *   version: 2023-10-31
 */

import { z } from '@kbn/zod';

import {
  Page,
  PageSize,
  Commands,
  AgentIds,
  UserIds,
  StartDate,
  EndDate,
  AgentTypes,
  WithOutputs,
  Types,
} from '../../model/schema/common.gen';

export type GetEndpointActionListResponse = z.infer<typeof GetEndpointActionListResponse>;
export const GetEndpointActionListResponse = z.object({});

export type EndpointGetActionsListRequestQuery = z.infer<typeof EndpointGetActionsListRequestQuery>;
export const EndpointGetActionsListRequestQuery = z.object({
  page: Page.optional(),
  pageSize: PageSize.optional(),
  commands: Commands.optional(),
  agentIds: AgentIds.optional(),
  userIds: UserIds.optional(),
  startDate: StartDate.optional(),
  endDate: EndDate.optional(),
  agentTypes: AgentTypes.optional(),
  withOutputs: WithOutputs.optional(),
  types: Types.optional(),
});
export type EndpointGetActionsListRequestQueryInput = z.input<
  typeof EndpointGetActionsListRequestQuery
>;

export type EndpointGetActionsListResponse = z.infer<typeof EndpointGetActionsListResponse>;
export const EndpointGetActionsListResponse = GetEndpointActionListResponse;
