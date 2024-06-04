/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { SLODefinition } from '../../../domain/models';
import { getDelayInSecondsFromSLO } from '../../../domain/services/get_delay_in_seconds_from_slo';

const FIVE_MINUTES_IN_SECONDS = 300;
const ONE_HOUR_IN_SECONDS = 3600;
const ONE_DAY_IN_SECONDS = 86400;

export function getFiveMinuteRange(slo: SLODefinition) {
  const delayInSeconds = getDelayInSecondsFromSLO(slo);
  return {
    gte: `now-${FIVE_MINUTES_IN_SECONDS + delayInSeconds}s/m`,
    lte: `now-${delayInSeconds}s/m`,
  };
}

export function getOneHourRange(slo: SLODefinition) {
  const delayInSeconds = getDelayInSecondsFromSLO(slo);
  return {
    gte: `now-${ONE_HOUR_IN_SECONDS + delayInSeconds}s/m`,
    lte: `now-${delayInSeconds}s/m`,
  };
}

export function getOneDayRange(slo: SLODefinition) {
  const delayInSeconds = getDelayInSecondsFromSLO(slo);
  return {
    gte: `now-${ONE_DAY_IN_SECONDS + delayInSeconds}s/m`,
    lte: `now-${delayInSeconds}s/m`,
  };
}
