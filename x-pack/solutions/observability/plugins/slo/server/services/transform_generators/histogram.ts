/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import type { TransformPutTransformRequest } from '@elastic/elasticsearch/lib/api/types';
import { histogramIndicatorSchema } from '@kbn/slo-schema';
import { TransformGenerator } from '.';
import { getSLOTransformTemplate } from '../../assets/transform_templates/slo_transform_template';
import type { SLODefinition } from '../../domain/models';
import { InvalidTransformError } from '../../errors';
import { GetHistogramIndicatorAggregation } from '../aggregations';

export class HistogramTransformGenerator extends TransformGenerator {
  public async getTransformParams(slo: SLODefinition): Promise<TransformPutTransformRequest> {
    if (!histogramIndicatorSchema.is(slo.indicator)) {
      throw new InvalidTransformError(`Cannot handle SLO of indicator type: ${slo.indicator.type}`);
    }

    const { dataView, source } = await this.buildDefaultSource(slo, slo.indicator);
    const getHistogramIndicatorAggregations = new GetHistogramIndicatorAggregation(
      slo.indicator,
      dataView
    );

    return getSLOTransformTemplate(
      this.buildTransformId(slo),
      this.buildDescription(slo),
      source,
      this.buildDestination(slo),
      this.buildCommonGroupBy(slo, slo.indicator.params.timestampField),
      {
        ...getHistogramIndicatorAggregations.execute({
          type: 'good',
          aggregationKey: 'slo.numerator',
        }),
        ...getHistogramIndicatorAggregations.execute({
          type: 'total',
          aggregationKey: 'slo.denominator',
        }),
        ...this.buildTimesliceAggregation(slo, 'slo.numerator>value', 'slo.denominator>value'),
      },
      this.buildSettings(slo, slo.indicator.params.timestampField),
      slo
    );
  }
}
