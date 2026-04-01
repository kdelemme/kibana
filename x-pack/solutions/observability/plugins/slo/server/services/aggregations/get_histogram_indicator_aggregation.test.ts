/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { createHistogramIndicator } from '../fixtures/slo';
import { getHistogramIndicatorAggregation } from './get_histogram_indicator_aggregation';

describe('getHistogramIndicatorAggregation', () => {
  it('should generate a aggregation for good events', () => {
    expect(
      getHistogramIndicatorAggregation({
        indicator: createHistogramIndicator(),
        type: 'good',
        aggregationKey: 'goodEvents',
      })
    ).toMatchSnapshot();
  });

  it('should generate a aggregation for total events', () => {
    expect(
      getHistogramIndicatorAggregation({
        indicator: createHistogramIndicator(),
        type: 'total',
        aggregationKey: 'totalEvents',
      })
    ).toMatchSnapshot();
  });

  it('should throw and error when the "from" is greater than "to"', () => {
    expect(() =>
      getHistogramIndicatorAggregation({
        indicator: createHistogramIndicator({
          good: {
            field: 'latency',
            aggregation: 'range',
            from: 100,
            to: 0,
            filter: '',
          },
        }),
        type: 'good',
        aggregationKey: 'goodEvents',
      })
    ).toThrow('Invalid Range: "from" should be less that "to".');
  });

  it('should generate a value_count aggregation for good events', () => {
    expect(
      getHistogramIndicatorAggregation({
        indicator: createHistogramIndicator({
          good: {
            field: 'latency',
            aggregation: 'value_count',
            filter: '',
          },
        }),
        type: 'good',
        aggregationKey: 'goodEvents',
      })
    ).toMatchSnapshot();
  });

  it('should include the filter for good events when provided', () => {
    expect(
      getHistogramIndicatorAggregation({
        indicator: createHistogramIndicator({
          good: {
            field: 'latency',
            aggregation: 'range',
            from: 0,
            to: 100,
            filter: 'some.field: value',
          },
        }),
        type: 'good',
        aggregationKey: 'goodEvents',
      })
    ).toMatchSnapshot();
  });

  it('should include the filter for total events when provided', () => {
    expect(
      getHistogramIndicatorAggregation({
        indicator: createHistogramIndicator({
          total: {
            field: 'latency',
            aggregation: 'value_count',
            filter: 'some.field: value',
          },
        }),
        type: 'total',
        aggregationKey: 'totalEvents',
      })
    ).toMatchSnapshot();
  });

  it('should throw when from and to are both missing for range aggregation', () => {
    expect(() =>
      getHistogramIndicatorAggregation({
        indicator: createHistogramIndicator({
          good: {
            field: 'latency',
            aggregation: 'range',
            from: undefined as unknown as number,
            to: undefined as unknown as number,
            filter: '',
          },
        }),
        type: 'good',
        aggregationKey: 'goodEvents',
      })
    ).toThrow('Invalid Range: both "from" or "to" are required for a range aggregation.');
  });
});
