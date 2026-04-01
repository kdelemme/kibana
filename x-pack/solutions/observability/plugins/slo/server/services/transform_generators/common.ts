/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import type { estypes } from '@elastic/elasticsearch';
import { buildEsQuery } from '@kbn/es-query';
import type { QuerySchema } from '@kbn/slo-schema';
import { ALL_VALUE, kqlQuerySchema } from '@kbn/slo-schema';
import type { Logger } from '@kbn/logging';
import type { DataView } from '@kbn/data-views-plugin/common';
import { isEmpty } from 'lodash';
import type { SLODefinition } from '../../domain/models';
import { getDelayInSecondsFromSLO } from '../../domain/services/get_delay_in_seconds_from_slo';
import { InvalidTransformError } from '../../errors';

export function getElasticsearchQueryOrThrow(kuery: QuerySchema = '', dataView?: DataView) {
  try {
    if (isEmpty(kuery)) {
      return { match_all: {} };
    }
    const kqlQuery = kqlQuerySchema.is(kuery) ? kuery : kuery.kqlQuery;
    const filters = kqlQuerySchema.is(kuery) ? [] : kuery.filters;
    return buildEsQuery(
      dataView,
      {
        query: kqlQuery,
        language: 'kuery',
      },
      filters,
      {
        allowLeadingWildcards: true,
      }
    );
  } catch (err) {
    if (kqlQuerySchema.is(kuery)) {
      throw new InvalidTransformError(`Invalid KQL: ${kuery}`);
    } else {
      throw new InvalidTransformError(`Invalid KQL: ${kuery.kqlQuery}`);
    }
  }
}

export function parseStringFilters(filters: string, logger: Logger) {
  if (!filters) {
    return {};
  }
  try {
    return JSON.parse(filters);
  } catch (e) {
    logger.debug(`Failed to parse filters: ${e}`);
    return {};
  }
}

export function parseIndex(index: string): string | string[] {
  if (index.indexOf(',') === -1) {
    return index;
  }

  return index.split(',');
}

export function getTimesliceTargetComparator(timesliceTarget: number) {
  return timesliceTarget === 0 ? '>' : '>=';
}

export const INVALID_EQUATION_REGEX = /[^A-Z|+|\-|\s|\d+|\.|\(|\)|\/|\*|>|<|=|\?|\:|&|\!|\|]+/g;

export const buildApmSourceFilters = (
  indicator: {
    params: {
      service: string;
      environment: string;
      transactionName: string;
      transactionType: string;
      filter?: QuerySchema;
    };
  },
  dataView?: DataView
): estypes.QueryDslQueryContainer[] => {
  const filters: estypes.QueryDslQueryContainer[] = [];
  if (indicator.params.service !== ALL_VALUE) {
    filters.push({ match: { 'service.name': indicator.params.service } });
  }
  if (indicator.params.environment !== ALL_VALUE) {
    filters.push({ match: { 'service.environment': indicator.params.environment } });
  }
  if (indicator.params.transactionName !== ALL_VALUE) {
    filters.push({ match: { 'transaction.name': indicator.params.transactionName } });
  }
  if (indicator.params.transactionType !== ALL_VALUE) {
    filters.push({ match: { 'transaction.type': indicator.params.transactionType } });
  }
  if (indicator.params.filter) {
    filters.push(getElasticsearchQueryOrThrow(indicator.params.filter, dataView));
  }
  return filters;
};

export const buildApmExtraGroupByFields = (indicator: {
  params: {
    service: string;
    environment: string;
    transactionName: string;
    transactionType: string;
  };
}) => ({
  ...(indicator.params.service !== ALL_VALUE && {
    'service.name': { terms: { field: 'service.name' } },
  }),
  ...(indicator.params.environment !== ALL_VALUE && {
    'service.environment': { terms: { field: 'service.environment' } },
  }),
  ...(indicator.params.transactionName !== ALL_VALUE && {
    'transaction.name': { terms: { field: 'transaction.name' } },
  }),
  ...(indicator.params.transactionType !== ALL_VALUE && {
    'transaction.type': { terms: { field: 'transaction.type' } },
  }),
});

/**
 * Use the settings.preventInitialBackfill flag to determine the range filter for the rollup transform
 * preventInitialBackfill == true: we use the current time minus some buffer to account for the ingestion delay
 * preventInitialBackfill === false: we use the time window duration to get the data for the last N days
 */
export function getFilterRange(slo: SLODefinition, timestampField: string, isServerless: boolean) {
  if (slo.settings.preventInitialBackfill) {
    return {
      range: {
        [timestampField]: {
          gte: `now-${getDelayInSecondsFromSLO(slo)}s/m`,
        },
      },
    };
  }

  if (isServerless) {
    return {
      range: {
        [timestampField]: {
          gte: `now-7d`,
        },
      },
    };
  }

  return {
    range: {
      [timestampField]: {
        gte: `now-${slo.timeWindow.duration.format()}/d`,
      },
    },
  };
}
