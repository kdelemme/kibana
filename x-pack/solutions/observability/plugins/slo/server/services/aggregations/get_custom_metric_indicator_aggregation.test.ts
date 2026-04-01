/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { getCustomMetricIndicatorAggregation } from './get_custom_metric_indicator_aggregation';
import { createMetricCustomIndicator } from '../fixtures/slo';

describe('getCustomMetricIndicatorAggregation', () => {
  it('should generate a aggregation for good events', () => {
    expect(
      getCustomMetricIndicatorAggregation({
        indicator: createMetricCustomIndicator(),
        type: 'good',
        aggregationKey: 'goodEvents',
      })
    ).toMatchSnapshot();
  });

  it('should generate a aggregation for total events', () => {
    expect(
      getCustomMetricIndicatorAggregation({
        indicator: createMetricCustomIndicator(),
        type: 'total',
        aggregationKey: 'totalEvents',
      })
    ).toMatchSnapshot();
  });

  it('should generate a doc_count aggregation', () => {
    expect(
      getCustomMetricIndicatorAggregation({
        indicator: createMetricCustomIndicator({
          good: {
            metrics: [{ name: 'A', aggregation: 'doc_count', filter: 'outcome: success' }],
            equation: 'A',
          },
        }),
        type: 'good',
        aggregationKey: 'goodEvents',
      })
    ).toMatchSnapshot();
  });

  it('should include the filter when provided on a metric', () => {
    expect(
      getCustomMetricIndicatorAggregation({
        indicator: createMetricCustomIndicator({
          good: {
            metrics: [
              {
                name: 'A',
                aggregation: 'sum',
                field: 'total',
                filter: 'outcome: success',
              },
            ],
            equation: 'A',
          },
        }),
        type: 'good',
        aggregationKey: 'goodEvents',
      })
    ).toMatchSnapshot();
  });
});
