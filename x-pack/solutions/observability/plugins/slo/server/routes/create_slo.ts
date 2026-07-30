/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { createSLOParamsSchema } from '@kbn/slo-schema';
import { createSloServerRoute } from './utils/create_slo_server_route';
import { assertPlatinumLicense } from './utils/assert_platinum_license';
import { createSloServerClient } from '../client/slo_server_client';

export const createSLORoute = createSloServerRoute({
  endpoint: 'POST /api/observability/slos 2023-10-31',
  options: { access: 'public' },
  security: {
    authz: {
      requiredPrivileges: ['slo_write'],
    },
  },
  params: createSLOParamsSchema,
  handler: async ({ params, logger, request, plugins, getScopedClients }) => {
    await assertPlatinumLicense(plugins);

    const sloServerClient = await createSloServerClient({
      scopedClients: await getScopedClients({ request, logger }),
      logger,
    });

    return await sloServerClient.createSlo(params.body);
  },
});
