/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import type { AggregationsAggregationContainer } from '@elastic/elasticsearch/lib/api/types';
import type { TransformPutTransformRequest } from '@elastic/elasticsearch/lib/api/types';
import { apmTransactionDurationIndicatorSchema } from '@kbn/slo-schema';
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

export class ApmTransactionDurationTransformGenerator extends TransformGenerator {
  public async getTransformParams(slo: SLODefinition): Promise<TransformPutTransformRequest> {
    if (!apmTransactionDurationIndicatorSchema.is(slo.indicator)) {
      throw new InvalidTransformError(`Cannot handle SLO of indicator type: ${slo.indicator.type}`);
    }

    const dataView = await this.getIndicatorDataView(slo.indicator.params.dataViewId);
    const truncatedThreshold = Math.trunc(slo.indicator.params.threshold * 1000);

    return getSLOTransformTemplate(
      this.buildTransformId(slo),
      this.buildDescription(slo),
      {
        index: parseIndex(slo.indicator.params.index),
        runtime_mappings: this.buildCommonRuntimeMappings(dataView),
        query: {
          bool: {
            filter: [
              { terms: { 'processor.event': ['metric'] } },
              { term: { 'metricset.name': 'transaction' } },
              { exists: { field: 'transaction.duration.histogram' } },
              getFilterRange(slo, '@timestamp', this.isServerless),
              ...buildApmSourceFilters(slo.indicator, dataView),
            ],
          },
        },
      },
      this.buildDestination(slo),
      this.buildCommonGroupBy(slo, '@timestamp', buildApmExtraGroupByFields(slo.indicator)),
      {
        _numerator: {
          range: {
            field: 'transaction.duration.histogram',
            keyed: true,
            ranges: [{ to: truncatedThreshold, key: 'target' }],
          },
        },
        'slo.numerator': {
          bucket_script: {
            buckets_path: { numerator: `_numerator['target']>_count` },
            script: 'params.numerator',
          },
        },
        'slo.denominator': {
          value_count: { field: 'transaction.duration.histogram' },
        },
        ...this.buildTimesliceAggregation(slo, 'slo.numerator.value', 'slo.denominator.value'),
      } as Record<string, AggregationsAggregationContainer>,
      this.buildSettings(slo, '@timestamp'),
      slo
    );
  }
}
