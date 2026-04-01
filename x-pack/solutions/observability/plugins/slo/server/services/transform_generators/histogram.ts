/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import type { TransformPutTransformRequest } from '@elastic/elasticsearch/lib/api/types';
import { histogramIndicatorSchema } from '@kbn/slo-schema';
import { TransformGenerator } from '.';
import { getSLOTransformTemplate } from './slo_transform_template';
import type { SLODefinition } from '../../domain/models';
import { InvalidTransformError } from '../../errors';
import { getHistogramIndicatorAggregation } from '../aggregations';

export class HistogramTransformGenerator extends TransformGenerator {
  public async getTransformParams(slo: SLODefinition): Promise<TransformPutTransformRequest> {
    if (!histogramIndicatorSchema.is(slo.indicator)) {
      throw new InvalidTransformError(`Cannot handle SLO of indicator type: ${slo.indicator.type}`);
    }

    const { dataView, source } = await this.buildDefaultSource(slo, slo.indicator);

    return getSLOTransformTemplate(
      this.buildTransformId(slo),
      this.buildDescription(slo),
      source,
      this.buildDestination(slo),
      this.buildCommonGroupBy(slo, slo.indicator.params.timestampField),
      {
        ...getHistogramIndicatorAggregation({
          indicator: slo.indicator,
          type: 'good',
          aggregationKey: 'slo.numerator',
          dataView,
        }),
        ...getHistogramIndicatorAggregation({
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
