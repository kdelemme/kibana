/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import {
  MappingRuntimeFields,
  TransformPutTransformRequest,
} from '@elastic/elasticsearch/lib/api/typesWithBodyKey';
import { ALL_VALUE, timeslicesBudgetingMethodSchema } from '@kbn/slo-schema';
import { TransformSettings } from '../../../assets/transform_templates/slo_transform_template';
import { SLO } from '../../../domain/models';

export abstract class TransformGenerator {
  public abstract getTransformParams(slo: SLO): TransformPutTransformRequest;

  public buildCommonRuntimeMappings(slo: SLO): MappingRuntimeFields {
    const mustIncludeAllInstanceId = slo.groupBy === ALL_VALUE || slo.groupBy === '';

    return {
      'slo.id': {
        type: 'keyword',
        script: {
          source: `emit('${slo.id}')`,
        },
      },
      'slo.revision': {
        type: 'long',
        script: {
          source: `emit(${slo.revision})`,
        },
      },
      ...(mustIncludeAllInstanceId && {
        'slo.instanceId': {
          type: 'keyword',
          script: {
            source: `emit('${ALL_VALUE}')`,
          },
        },
      }),
    };
  }

  public buildDescription(slo: SLO): string {
    return `Rolled-up SLI data for SLO: ${slo.name}`;
  }

  public buildCommonGroupBy(
    slo: SLO,
    sourceIndexTimestampField: string | undefined = '@timestamp',
    extraGroupByFields = {}
  ) {
    let fixedInterval = '1m';
    if (timeslicesBudgetingMethodSchema.is(slo.budgetingMethod)) {
      fixedInterval = slo.objective.timesliceWindow!.format();
    }

    const instanceIdField =
      slo.groupBy !== '' && slo.groupBy !== ALL_VALUE ? slo.groupBy : 'slo.instanceId';

    return {
      'slo.id': { terms: { field: 'slo.id' } },
      'slo.revision': { terms: { field: 'slo.revision' } },
      'slo.instanceId': { terms: { field: instanceIdField } },
      ...extraGroupByFields,
      // @timestamp field defined in the destination index
      '@timestamp': {
        date_histogram: {
          field: sourceIndexTimestampField, // timestamp field defined in the source index
          fixed_interval: fixedInterval,
        },
      },
    };
  }

  public buildSettings(
    slo: SLO,
    sourceIndexTimestampField: string | undefined = '@timestamp'
  ): TransformSettings {
    return {
      frequency: slo.settings.frequency.format(),
      sync_field: sourceIndexTimestampField, // timestamp field defined in the source index
      sync_delay: slo.settings.syncDelay.format(),
    };
  }
}
