/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import type { MetricCustomIndicator } from '@kbn/slo-schema';
import { metricCustomDocCountMetric } from '@kbn/slo-schema';
import type { DataView } from '@kbn/data-views-plugin/common';
import { getElasticsearchQueryOrThrow } from '../transform_generators';

type MetricCustomMetricDef =
  | MetricCustomIndicator['params']['good']
  | MetricCustomIndicator['params']['total'];

const buildMetricAggregations = (
  type: 'good' | 'total',
  metricDef: MetricCustomMetricDef,
  dataView?: DataView
) => {
  return metricDef.metrics.reduce((acc, metric) => {
    const filter = metric.filter
      ? getElasticsearchQueryOrThrow(metric.filter, dataView)
      : { match_all: {} };

    if (metricCustomDocCountMetric.is(metric)) {
      return {
        ...acc,
        [`_${type}_${metric.name}`]: {
          filter,
        },
      };
    }

    return {
      ...acc,
      [`_${type}_${metric.name}`]: {
        filter,
        aggs: {
          metric: {
            [metric.aggregation]: { field: metric.field },
          },
        },
      },
    };
  }, {});
};

const convertEquationToPainless = (
  bucketsPath: Record<string, string>,
  equation: string
): string => {
  const workingEquation = equation || Object.keys(bucketsPath).join(' + ');
  return Object.keys(bucketsPath).reduce((acc, key) => {
    return acc.replaceAll(key, `params.${key}`);
  }, workingEquation);
};

const buildMetricEquation = (type: 'good' | 'total', metricDef: MetricCustomMetricDef) => {
  const bucketsPath = metricDef.metrics.reduce((acc, metric) => {
    const path = metricCustomDocCountMetric.is(metric) ? '_count' : 'metric';
    return { ...acc, [metric.name]: `_${type}_${metric.name}>${path}` };
  }, {});

  return {
    bucket_script: {
      buckets_path: bucketsPath,
      script: {
        source: convertEquationToPainless(bucketsPath, metricDef.equation),
        lang: 'painless',
      },
    },
  };
};

export const getCustomMetricIndicatorAggregation = ({
  indicator,
  type,
  aggregationKey,
  dataView,
}: {
  indicator: MetricCustomIndicator;
  type: 'good' | 'total';
  aggregationKey: string;
  dataView?: DataView;
}) => {
  const indicatorDef = indicator.params[type];
  return {
    ...buildMetricAggregations(type, indicatorDef, dataView),
    [aggregationKey]: buildMetricEquation(type, indicatorDef),
  };
};
