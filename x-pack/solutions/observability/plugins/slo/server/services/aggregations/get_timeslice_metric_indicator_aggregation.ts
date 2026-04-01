/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import type { TimesliceMetricIndicator, timesliceMetricMetricDef } from '@kbn/slo-schema';
import type * as t from 'io-ts';
import { assertNever } from '@kbn/std';
import type { DataView } from '@kbn/data-views-plugin/common';

import { getElasticsearchQueryOrThrow } from '../transform_generators';
import { convertEquationToPainless } from './convert_equation_to_painless';

type TimesliceMetricDef = TimesliceMetricIndicator['params']['metric'];
type TimesliceMetricMetricDef = t.TypeOf<typeof timesliceMetricMetricDef>;

const buildAggregation = (metric: TimesliceMetricMetricDef, timestampField: string) => {
  const { aggregation } = metric;
  switch (aggregation) {
    case 'doc_count':
      return {};
    case 'std_deviation':
      return {
        extended_stats: { field: metric.field },
      };
    case 'percentile':
      if (metric.percentile == null) {
        throw new Error('You must provide a percentile value for percentile aggregations.');
      }
      return {
        percentiles: {
          field: metric.field,
          percents: [metric.percentile],
          keyed: true,
        },
      };
    case 'last_value':
      return {
        top_metrics: {
          metrics: { field: metric.field },
          sort: { [timestampField]: 'desc' },
        },
      };
    case 'avg':
    case 'max':
    case 'min':
    case 'sum':
    case 'cardinality':
      if (metric.field == null) {
        throw new Error('You must provide a field for basic metric aggregations.');
      }
      return {
        [aggregation]: { field: metric.field },
      };
    default:
      assertNever(aggregation);
  }
};

const buildBucketPath = (prefix: string, metric: TimesliceMetricMetricDef) => {
  const { aggregation } = metric;
  switch (aggregation) {
    case 'doc_count':
      return `${prefix}>_count`;
    case 'std_deviation':
      return `${prefix}>metric[std_deviation]`;
    case 'percentile':
      return `${prefix}>metric[${metric.percentile}]`;
    case 'last_value':
      return `${prefix}>metric[${metric.field}]`;
    case 'avg':
    case 'max':
    case 'min':
    case 'sum':
    case 'cardinality':
      return `${prefix}>metric`;
    default:
      assertNever(aggregation);
  }
};

const buildMetricAggregations = (
  metricDef: TimesliceMetricDef,
  timestampField: string,
  dataView?: DataView
) => {
  return metricDef.metrics.reduce((acc, metric) => {
    const filter = metric.filter
      ? getElasticsearchQueryOrThrow(metric.filter, dataView)
      : { match_all: {} };
    const aggs = { metric: buildAggregation(metric, timestampField) };
    return {
      ...acc,
      [`_${metric.name}`]: {
        filter,
        ...(metric.aggregation !== 'doc_count' ? { aggs } : {}),
      },
    };
  }, {});
};

const buildMetricEquation = (definition: TimesliceMetricDef) => {
  const bucketsPath = definition.metrics.reduce(
    (acc, metric) => ({ ...acc, [metric.name]: buildBucketPath(`_${metric.name}`, metric) }),
    {}
  );
  return {
    bucket_script: {
      buckets_path: bucketsPath,
      script: {
        source: convertEquationToPainless(bucketsPath, definition.equation),
        lang: 'painless',
      },
    },
  };
};

export const getTimesliceMetricIndicatorAggregation = ({
  indicator,
  aggregationKey,
  dataView,
}: {
  indicator: TimesliceMetricIndicator;
  aggregationKey: string;
  dataView?: DataView;
}) => {
  return {
    ...buildMetricAggregations(indicator.params.metric, indicator.params.timestampField, dataView),
    [aggregationKey]: buildMetricEquation(indicator.params.metric),
  };
};
