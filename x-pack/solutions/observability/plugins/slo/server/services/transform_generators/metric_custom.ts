/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import type { TransformPutTransformRequest } from '@elastic/elasticsearch/lib/api/types';
import { metricCustomIndicatorSchema } from '@kbn/slo-schema';
import { TransformGenerator } from '.';
import { getSLOTransformTemplate } from '../../assets/transform_templates/slo_transform_template';
import type { SLODefinition } from '../../domain/models';
import { InvalidTransformError } from '../../errors';
import { getCustomMetricIndicatorAggregation } from '../aggregations';
import { INVALID_EQUATION_REGEX } from './common';

export class MetricCustomTransformGenerator extends TransformGenerator {
  public async getTransformParams(slo: SLODefinition): Promise<TransformPutTransformRequest> {
    if (!metricCustomIndicatorSchema.is(slo.indicator)) {
      throw new InvalidTransformError(`Cannot handle SLO of indicator type: ${slo.indicator.type}`);
    }

    if (slo.indicator.params.good.equation.match(INVALID_EQUATION_REGEX)) {
      throw new Error(`Invalid equation: ${slo.indicator.params.good.equation}`);
    }

    if (slo.indicator.params.total.equation.match(INVALID_EQUATION_REGEX)) {
      throw new Error(`Invalid equation: ${slo.indicator.params.total.equation}`);
    }

    const { dataView, source } = await this.buildDefaultSource(slo, slo.indicator);

    return getSLOTransformTemplate(
      this.buildTransformId(slo),
      this.buildDescription(slo),
      source,
      this.buildDestination(slo),
      this.buildCommonGroupBy(slo, slo.indicator.params.timestampField),
      {
        ...getCustomMetricIndicatorAggregation({
          indicator: slo.indicator,
          type: 'good',
          aggregationKey: 'slo.numerator',
          dataView,
        }),
        ...getCustomMetricIndicatorAggregation({
          indicator: slo.indicator,
          type: 'total',
          aggregationKey: 'slo.denominator',
          dataView,
        }),
        ...this.buildTimesliceAggregation(slo, 'slo.numerator>value', 'slo.denominator>value'),
      },
      this.buildSettings(slo, slo.indicator.params.timestampField),
      slo
    );
  }
}
