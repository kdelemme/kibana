/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import type { TransformPutTransformRequest } from '@elastic/elasticsearch/lib/api/types';
import { kqlCustomIndicatorSchema } from '@kbn/slo-schema';
import { TransformGenerator, getElasticsearchQueryOrThrow } from '.';
import { getSLOTransformTemplate } from './slo_transform_template';
import type { SLODefinition } from '../../domain/models';
import { InvalidTransformError } from '../../errors';

export class KQLCustomTransformGenerator extends TransformGenerator {
  public async getTransformParams(slo: SLODefinition): Promise<TransformPutTransformRequest> {
    if (!kqlCustomIndicatorSchema.is(slo.indicator)) {
      throw new InvalidTransformError(`Cannot handle SLO of indicator type: ${slo.indicator.type}`);
    }

    const { source } = await this.buildDefaultSource(slo, slo.indicator);
    const numerator = getElasticsearchQueryOrThrow(slo.indicator.params.good);
    const denominator = getElasticsearchQueryOrThrow(slo.indicator.params.total);

    return getSLOTransformTemplate(
      this.buildTransformId(slo),
      this.buildDescription(slo),
      source,
      this.buildDestination(slo),
      this.buildCommonGroupBy(slo, slo.indicator.params.timestampField),
      {
        'slo.numerator': { filter: numerator },
        'slo.denominator': { filter: denominator },
        ...this.buildTimesliceAggregation(slo, 'slo.numerator>_count', 'slo.denominator>_count'),
      },
      this.buildSettings(slo, slo.indicator.params.timestampField),
      slo
    );
  }
}
