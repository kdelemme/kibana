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
 *   title: Find Conversations API endpoint
 *   version: 2023-10-31
 */

import { z } from '@kbn/zod';
import { ArrayFromString } from '@kbn/zod-helpers';

import { SortOrder } from '../common_attributes.gen';
import { ConversationResponse } from './common_attributes.gen';

export type FindConversationsSortField = z.infer<typeof FindConversationsSortField>;
export const FindConversationsSortField = z.enum(['created_at', 'title', 'updated_at']);
export type FindConversationsSortFieldEnum = typeof FindConversationsSortField.enum;
export const FindConversationsSortFieldEnum = FindConversationsSortField.enum;

export type FindConversationsRequestQuery = z.infer<typeof FindConversationsRequestQuery>;
export const FindConversationsRequestQuery = z.object({
  fields: ArrayFromString(z.string()).optional(),
  /**
   * Search query
   */
  filter: z.string().optional(),
  /**
   * Field to sort by
   */
  sort_field: FindConversationsSortField.optional(),
  /**
   * Sort order
   */
  sort_order: SortOrder.optional(),
  /**
   * Page number
   */
  page: z.coerce.number().int().min(1).optional().default(1),
  /**
   * Conversations per page
   */
  per_page: z.coerce.number().int().min(0).optional().default(20),
});
export type FindConversationsRequestQueryInput = z.input<typeof FindConversationsRequestQuery>;

export type FindConversationsResponse = z.infer<typeof FindConversationsResponse>;
export const FindConversationsResponse = z.object({
  page: z.number().int(),
  perPage: z.number().int(),
  total: z.number().int(),
  data: z.array(ConversationResponse),
});
