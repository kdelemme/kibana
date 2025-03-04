/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import type { DomainDeprecationDetails } from '@kbn/core-deprecations-common';

/**
 * Server-side client that provides access to fetch all Kibana deprecations
 *
 * @public
 */
export interface DeprecationsClient {
  /**
   * Fetch all Kibana deprecations.
   */
  getAllDeprecations: () => Promise<DomainDeprecationDetails[]>;
}

/**
 * Core's `deprecations` request handler context.
 * @public
 */
export interface DeprecationsRequestHandlerContext {
  /**
   * {@link DeprecationsClient | Deprecations client} exposed in the request handler context.
   */
  client: DeprecationsClient;
}
