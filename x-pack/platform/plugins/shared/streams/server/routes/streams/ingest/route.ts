/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { badData, badRequest } from '@hapi/boom';
import {
  IngestGetResponse,
  IngestStreamUpsertRequest,
  ingestUpsertRequestSchema,
  isUnwiredStreamDefinition,
  isWiredIngestUpsertRequest,
  isWiredStreamDefinition,
} from '@kbn/streams-schema';
import { z } from '@kbn/zod';
import { createServerRoute } from '../../create_server_route';

const readIngestRoute = createServerRoute({
  endpoint: 'GET /api/streams/{name}/_ingest 2023-10-31',
  options: {
    access: 'public',
    summary: 'Get ingest stream settings',
    description: 'Fetches the ingest settings of an ingest stream definition',
    availability: {
      stability: 'experimental',
    },
  },
  security: {
    authz: {
      enabled: false,
      reason:
        'This API delegates security to the currently logged in user and their Elasticsearch permissions.',
    },
  },
  params: z.object({
    path: z.object({ name: z.string() }),
  }),
  handler: async ({ params, request, getScopedClients }): Promise<IngestGetResponse> => {
    const { streamsClient } = await getScopedClients({
      request,
    });

    const name = params.path.name;

    const definition = await streamsClient.getStream(name);

    if (isWiredStreamDefinition(definition)) {
      return { ingest: definition.ingest };
    }

    if (isUnwiredStreamDefinition(definition)) {
      return { ingest: definition.ingest };
    }

    throw badRequest(`Stream is not an ingest stream`);
  },
});

const upsertIngestRoute = createServerRoute({
  endpoint: 'PUT /api/streams/{name}/_ingest 2023-10-31',
  options: {
    access: 'public',
    summary: 'Update ingest stream settings',
    description: 'Upserts the ingest settings of an ingest stream definition',
    availability: {
      stability: 'experimental',
    },
  },
  security: {
    authz: {
      enabled: false,
      reason:
        'This API delegates security to the currently logged in user and their Elasticsearch permissions.',
    },
  },
  params: z.object({
    path: z.object({
      name: z.string(),
    }),
    body: ingestUpsertRequestSchema,
  }),
  handler: async ({ params, request, getScopedClients }) => {
    const { streamsClient, assetClient } = await getScopedClients({
      request,
    });
    const name = params.path.name;

    if (isWiredIngestUpsertRequest(params.body) && !(await streamsClient.isStreamsEnabled())) {
      throw badData('Streams are not enabled for Wired streams.');
    }

    const [existingStream, assets] = await Promise.all([
      streamsClient.getStream(name).catch(() => undefined),
      assetClient.getAssets({
        entityId: name,
        entityType: 'stream',
      }),
    ]);

    const ingestUpsertRequest = params.body;

    const dashboards = assets
      .filter((asset) => asset.assetType === 'dashboard')
      .map((asset) => asset.assetId);

    const upsertRequest = {
      dashboards,
      stream: { ...ingestUpsertRequest, description: existingStream?.description ?? '' },
    } as IngestStreamUpsertRequest;

    return await streamsClient.upsertStream({
      request: upsertRequest,
      name: params.path.name,
    });
  },
});

export const ingestRoutes = {
  ...readIngestRoute,
  ...upsertIngestRoute,
};
