/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import type { Logger } from '@kbn/core/server';
import type { CreateSLOParams, CreateSLOResponse } from '@kbn/slo-schema';
import type { RouteHandlerScopedClients } from '../routes/utils/types';
import { CreateSLO } from '../services';

interface SloServerClient {
  createSlo(params: CreateSLOParams): Promise<CreateSLOResponse>;
}

interface SloServerClientContext {
  scopedClients: RouteHandlerScopedClients;
  logger: Logger;
}

export async function createSloServerClient(
  context: SloServerClientContext
): Promise<SloServerClient> {
  return {
    createSlo: async (params: CreateSLOParams): Promise<CreateSLOResponse> => {
      const { scopedClients, logger } = context;
      const {
        scopedClusterClient,
        internalSoClient,
        spaceId,
        repository,
        transformManager,
        summaryTransformManager,
        basePath,
        userId,
      } = scopedClients;

      const createSLO = new CreateSLO(
        scopedClusterClient,
        repository,
        internalSoClient,
        transformManager,
        summaryTransformManager,
        logger,
        spaceId,
        basePath,
        userId ?? ''
      );

      return createSLO.execute(params);
    },
  };
}
