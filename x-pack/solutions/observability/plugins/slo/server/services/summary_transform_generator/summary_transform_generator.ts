/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import type { TransformPutTransformRequest } from '@elastic/elasticsearch/lib/api/types';
import type { SLODefinition } from '../../domain/models';
import { generateSummaryTransformForOccurrences } from './generators/occurrences';
import { generateSummaryTransformForTimeslicesAndCalendarAligned } from './generators/timeslices_calendar_aligned';
import { generateSummaryTransformForTimeslicesAndRolling } from './generators/timeslices_rolling';

export interface ISummaryTransformGenerator {
  generate(slo: SLODefinition): Promise<TransformPutTransformRequest>;
}

export class SummaryTransformGenerator implements ISummaryTransformGenerator {
  public async generate(slo: SLODefinition): Promise<TransformPutTransformRequest> {
    if (slo.budgetingMethod === 'occurrences') {
      return Promise.resolve(generateSummaryTransformForOccurrences(slo));
    } else if (slo.budgetingMethod === 'timeslices' && slo.timeWindow.type === 'rolling') {
      return Promise.resolve(generateSummaryTransformForTimeslicesAndRolling(slo));
    } else if (slo.budgetingMethod === 'timeslices' && slo.timeWindow.type === 'calendarAligned') {
      return Promise.resolve(generateSummaryTransformForTimeslicesAndCalendarAligned(slo));
    }

    throw new Error('Not supported SLO');
  }
}
