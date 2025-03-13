/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */
import { useCallback } from 'react';
import type { SanitizedDashboardAsset } from '@kbn/streams-plugin/server/routes/dashboards/route';
import { useAbortController } from '@kbn/react-hooks';
import { useKibana } from './use_kibana';

export const useDashboardsApi = (name?: string) => {
  const { signal } = useAbortController();
  const {
    dependencies: {
      start: {
        streams: { streamsRepositoryClient },
      },
    },
  } = useKibana();

  const addDashboards = useCallback(
    async (dashboards: SanitizedDashboardAsset[]) => {
      if (!name) {
        return;
      }

      await streamsRepositoryClient.fetch('POST /api/streams/{name}/dashboards/_bulk 2023-10-31', {
        signal,
        params: {
          path: {
            name,
          },
          body: {
            operations: dashboards.map((dashboard) => {
              return { index: { id: dashboard.id } };
            }),
          },
        },
      });
    },
    [name, signal, streamsRepositoryClient]
  );

  const removeDashboards = useCallback(
    async (dashboards: SanitizedDashboardAsset[]) => {
      if (!name) {
        return;
      }
      await streamsRepositoryClient.fetch('POST /api/streams/{name}/dashboards/_bulk 2023-10-31', {
        signal,
        params: {
          path: {
            name,
          },
          body: {
            operations: dashboards.map((dashboard) => {
              return { delete: { id: dashboard.id } };
            }),
          },
        },
      });
    },
    [name, signal, streamsRepositoryClient]
  );

  return {
    addDashboards,
    removeDashboards,
  };
};
