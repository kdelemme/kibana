/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import type { HistogramIndicator } from '@kbn/slo-schema';
import type { AggregationsAggregationContainer } from '@elastic/elasticsearch/lib/api/types';
import type { DataView } from '@kbn/data-views-plugin/common';
import { getElasticsearchQueryOrThrow } from '../transform_generators/common';

type HistogramIndicatorDef =
  | HistogramIndicator['params']['good']
  | HistogramIndicator['params']['total'];

const buildAggregation = (
  indicatorDef: HistogramIndicatorDef,
  dataView?: DataView
): AggregationsAggregationContainer => {
  const filter = indicatorDef.filter
    ? getElasticsearchQueryOrThrow(indicatorDef.filter, dataView)
    : { match_all: {} };
  if (indicatorDef.aggregation === 'value_count') {
    return {
      filter,
      aggs: {
        total: {
          value_count: { field: indicatorDef.field },
        },
      },
    };
  }

  if (
    indicatorDef.aggregation === 'range' &&
    (indicatorDef.from == null || indicatorDef.to == null)
  ) {
    throw new Error('Invalid Range: both "from" or "to" are required for a range aggregation.');
  }

  if (
    indicatorDef.aggregation === 'range' &&
    indicatorDef.from != null &&
    indicatorDef.to != null &&
    indicatorDef.from >= indicatorDef.to
  ) {
    throw new Error('Invalid Range: "from" should be less that "to".');
  }

  return {
    filter,
    aggs: {
      total: {
        range: {
          field: indicatorDef.field,
          keyed: true,
          ranges: [
            {
              key: 'target',
              from: indicatorDef.from,
              to: indicatorDef.to,
            },
          ],
        },
      },
    },
  };
};

const buildBucketScript = (
  type: 'good' | 'total',
  indicatorDef: HistogramIndicatorDef
): AggregationsAggregationContainer => {
  if (indicatorDef.aggregation === 'value_count') {
    return {
      bucket_script: {
        buckets_path: {
          value: `_${type}>total`,
        },
        script: 'params.value',
      },
    };
  }
  return {
    bucket_script: {
      buckets_path: {
        value: `_${type}>total['target']>_count`,
      },
      script: 'params.value',
    },
  };
};

export const getHistogramIndicatorAggregation = ({
  indicator,
  type,
  aggregationKey,
  dataView,
}: {
  indicator: HistogramIndicator;
  type: 'good' | 'total';
  aggregationKey: string;
  dataView?: DataView;
}) => {
  const indicatorDef = indicator.params[type];
  return {
    [`_${type}`]: buildAggregation(indicatorDef, dataView),
    [aggregationKey]: buildBucketScript(type, indicatorDef),
  };
};
