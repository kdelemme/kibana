/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import type { TransformPutTransformRequest } from '@elastic/elasticsearch/lib/api/types';
import type { DataViewsService } from '@kbn/data-views-plugin/server';
import {
  ApmTransactionDurationTransformGenerator,
  ApmTransactionErrorRateTransformGenerator,
  HistogramTransformGenerator,
  KQLCustomTransformGenerator,
  MetricCustomTransformGenerator,
  SyntheticsAvailabilityTransformGenerator,
  TimesliceMetricTransformGenerator,
} from '.';
import type { SLODefinition } from '../../domain/models';
import type { ITransformGenerator } from './transform_generator';

export class TransformGeneratorsFactory implements ITransformGenerator {
  constructor(
    private spaceId: string,
    private dataViewsService: DataViewsService,
    private isServerless: boolean
  ) {}

  public async generate(slo: SLODefinition): Promise<TransformPutTransformRequest> {
    switch (slo.indicator.type) {
      case 'sli.apm.transactionDuration':
        return new ApmTransactionDurationTransformGenerator(
          this.spaceId,
          this.dataViewsService,
          this.isServerless
        ).generate(slo);
      case 'sli.apm.transactionErrorRate':
        return new ApmTransactionErrorRateTransformGenerator(
          this.spaceId,
          this.dataViewsService,
          this.isServerless
        ).generate(slo);
      case 'sli.synthetics.availability':
        return new SyntheticsAvailabilityTransformGenerator(
          this.spaceId,
          this.dataViewsService,
          this.isServerless
        ).generate(slo);
      case 'sli.kql.custom':
        return new KQLCustomTransformGenerator(
          this.spaceId,
          this.dataViewsService,
          this.isServerless
        ).generate(slo);
      case 'sli.metric.custom':
        return new MetricCustomTransformGenerator(
          this.spaceId,
          this.dataViewsService,
          this.isServerless
        ).generate(slo);
      case 'sli.histogram.custom':
        return new HistogramTransformGenerator(
          this.spaceId,
          this.dataViewsService,
          this.isServerless
        ).generate(slo);
      case 'sli.metric.timeslice':
        return new TimesliceMetricTransformGenerator(
          this.spaceId,
          this.dataViewsService,
          this.isServerless
        ).generate(slo);
    }
  }
}
