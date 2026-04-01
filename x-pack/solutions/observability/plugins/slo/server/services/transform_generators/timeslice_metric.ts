/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import type { TransformPutTransformRequest } from '@elastic/elasticsearch/lib/api/types';
import {
  timesliceMetricComparatorMapping,
  timesliceMetricIndicatorSchema,
  timeslicesBudgetingMethodSchema,
} from '@kbn/slo-schema';
import { TransformGenerator } from '.';
import { getSLOTransformTemplate } from '../../assets/transform_templates/slo_transform_template';
import type { SLODefinition } from '../../domain/models';
import { InvalidTransformError } from '../../errors';
import { GetTimesliceMetricIndicatorAggregation } from '../aggregations';
import { INVALID_EQUATION_REGEX } from './common';

export class TimesliceMetricTransformGenerator extends TransformGenerator {
  public async getTransformParams(slo: SLODefinition): Promise<TransformPutTransformRequest> {
    if (!timesliceMetricIndicatorSchema.is(slo.indicator)) {
      throw new InvalidTransformError(`Cannot handle SLO of indicator type: ${slo.indicator.type}`);
    }

    if (slo.indicator.params.metric.equation.match(INVALID_EQUATION_REGEX)) {
      throw new Error(`Invalid equation: ${slo.indicator.params.metric.equation}`);
    }

    if (!timeslicesBudgetingMethodSchema.is(slo.budgetingMethod)) {
      throw new Error('The sli.metric.timeslice indicator MUST have a timeslice budgeting method.');
    }

    const { dataView, source } = await this.buildDefaultSource(slo, slo.indicator);
    const getIndicatorAggregation = new GetTimesliceMetricIndicatorAggregation(
      slo.indicator,
      dataView
    );
    const comparator = timesliceMetricComparatorMapping[slo.indicator.params.metric.comparator];

    return getSLOTransformTemplate(
      this.buildTransformId(slo),
      this.buildDescription(slo),
      source,
      this.buildDestination(slo),
      this.buildCommonGroupBy(slo, slo.indicator.params.timestampField),
      {
        ...getIndicatorAggregation.execute('_metric'),
        'slo.numerator': {
          bucket_script: {
            buckets_path: { value: '_metric>value' },
            script: {
              source: `params.value ${comparator} params.threshold ? 1 : 0`,
              params: { threshold: slo.indicator.params.metric.threshold },
            },
          },
        },
        'slo.denominator': {
          bucket_script: {
            buckets_path: {},
            script: '1',
          },
        },
        'slo.isGoodSlice': {
          bucket_script: {
            buckets_path: {
              goodEvents: 'slo.numerator>value',
            },
            script: `params.goodEvents == 1 ? 1 : 0`,
          },
        },
      },
      this.buildSettings(slo, slo.indicator.params.timestampField),
      slo
    );
  }
}
