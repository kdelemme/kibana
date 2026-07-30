/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import type { TransformPutTransformRequest } from '@elastic/elasticsearch/lib/api/types';
import type { SLODefinition } from '../domain/models';

export type TransformId = string;

export interface ITransformManager {
  install(slo: SLODefinition): Promise<TransformId>;
  inspect(slo: SLODefinition): Promise<TransformPutTransformRequest>;
  preview(transformId: TransformId): Promise<void>;
  start(transformId: TransformId): Promise<void>;
  stop(transformId: TransformId): Promise<void>;
  uninstall(transformId: TransformId): Promise<void>;
  getVersion(transformId: TransformId): Promise<number | undefined>;
}
