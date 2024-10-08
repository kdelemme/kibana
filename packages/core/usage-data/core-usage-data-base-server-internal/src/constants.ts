/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

/** @internal */
export const CORE_USAGE_STATS_TYPE = 'core-usage-stats';

/** @internal */
export const CORE_USAGE_STATS_ID = 'core-usage-stats';

/** @internal */
export const REPOSITORY_RESOLVE_OUTCOME_STATS = {
  EXACT_MATCH: 'savedObjectsRepository.resolvedOutcome.exactMatch',
  ALIAS_MATCH: 'savedObjectsRepository.resolvedOutcome.aliasMatch',
  CONFLICT: 'savedObjectsRepository.resolvedOutcome.conflict',
  NOT_FOUND: 'savedObjectsRepository.resolvedOutcome.notFound',
  TOTAL: 'savedObjectsRepository.resolvedOutcome.total',
};
