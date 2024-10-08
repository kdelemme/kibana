/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import type { TheHiveFieldsType } from '../../../common/types/domain';
import type { ICasesConnector } from '../types';

interface ExternalServiceFormatterParams extends TheHiveFieldsType {
  tags: string[];
  severity: number;
}

export type TheHiveCaseConnector = ICasesConnector<ExternalServiceFormatterParams>;
export type Format = ICasesConnector<ExternalServiceFormatterParams>['format'];
export type GetMapping = ICasesConnector<ExternalServiceFormatterParams>['getMapping'];
