/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { createSLOParamsSchema } from '@kbn/slo-schema';
import { CreateSLO } from '../services';
import { createSloServerRoute } from './utils/create_slo_server_route';
import { assertPlatinumLicense } from './utils/assert_platinum_license';

export const inspectSLORoute = createSloServerRoute({
  endpoint: 'POST /internal/observability/slos/_inspect',
  options: { access: 'internal' },
  security: {
    authz: {
      requiredPrivileges: ['slo_write'],
    },
  },
  params: createSLOParamsSchema,
  handler: async ({ params, logger, request, plugins, getScopedClients }) => {
    await assertPlatinumLicense(plugins);

    const {
      scopedClusterClient,
      internalSoClient,
      spaceId,
      repository,
      transformManager,
      summaryTransformManager,
      basePath,
      userId: username,
    } = await getScopedClients({ request, logger });

    const createSLO = new CreateSLO(
      scopedClusterClient,
      repository,
      internalSoClient,
      transformManager,
      summaryTransformManager,
      logger,
      spaceId,
      basePath,
      username ?? ''
    );

    return await createSLO.inspect(params.body);
  },
});
