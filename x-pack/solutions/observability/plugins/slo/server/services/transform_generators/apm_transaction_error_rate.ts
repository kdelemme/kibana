/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import type { TransformPutTransformRequest } from '@elastic/elasticsearch/lib/api/types';
import { apmTransactionErrorRateIndicatorSchema } from '@kbn/slo-schema';
import { TransformGenerator } from '.';
import { getSLOTransformTemplate } from '../../assets/transform_templates/slo_transform_template';
import type { SLODefinition } from '../../domain/models';
import { InvalidTransformError } from '../../errors';
import {
  buildApmExtraGroupByFields,
  buildApmSourceFilters,
  getFilterRange,
  parseIndex,
} from './common';

export class ApmTransactionErrorRateTransformGenerator extends TransformGenerator {
  public async getTransformParams(slo: SLODefinition): Promise<TransformPutTransformRequest> {
    if (!apmTransactionErrorRateIndicatorSchema.is(slo.indicator)) {
      throw new InvalidTransformError(`Cannot handle SLO of indicator type: ${slo.indicator.type}`);
    }

    const dataView = await this.getIndicatorDataView(slo.indicator.params.dataViewId);

    return getSLOTransformTemplate(
      this.buildTransformId(slo),
      this.buildDescription(slo),
      {
        index: parseIndex(slo.indicator.params.index),
        runtime_mappings: this.buildCommonRuntimeMappings(dataView),
        query: {
          bool: {
            filter: [
              { term: { 'metricset.name': 'transaction' } },
              { terms: { 'event.outcome': ['success', 'failure'] } },
              getFilterRange(slo, '@timestamp', this.isServerless),
              ...buildApmSourceFilters(slo.indicator, dataView),
            ],
          },
        },
      },
      this.buildDestination(slo),
      this.buildCommonGroupBy(slo, '@timestamp', buildApmExtraGroupByFields(slo.indicator)),
      {
        'slo.numerator': {
          filter: {
            bool: {
              should: {
                match: { 'event.outcome': 'success' },
              },
            },
          },
        },
        'slo.denominator': {
          filter: { match_all: {} },
        },
        ...this.buildTimesliceAggregation(slo, 'slo.numerator>_count', 'slo.denominator>_count'),
      },
      this.buildSettings(slo, '@timestamp'),
      slo
    );
  }
}
