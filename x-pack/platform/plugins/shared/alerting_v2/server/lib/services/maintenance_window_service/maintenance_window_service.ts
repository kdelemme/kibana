/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import type { FakeRawRequest } from '@kbn/core-http-server';
import { kibanaRequestFactory } from '@kbn/core-http-server-utils';
import type { IBasePath } from '@kbn/core/server';
import type { MaintenanceWindowsServerStart } from '@kbn/maintenance-windows-plugin/server';
import { addSpaceIdToPath } from '@kbn/spaces-plugin/server';
import pLimit from 'p-limit';
import type { LoggerServiceContract } from '../logger_service/logger_service';

const CACHE_INTERVAL_MS = 60_000;
const MAX_CONCURRENT_QUERIES = 3;

interface CacheEntry {
  lastUpdated: number;
  hasActive: boolean;
}

export interface MaintenanceWindowServiceContract {
  getActiveMaintenanceWindowSpaceIds(spaceIds: string[]): Promise<Set<string>>;
}

export class MaintenanceWindowService implements MaintenanceWindowServiceContract {
  private readonly cache = new Map<string, CacheEntry>();

  constructor(
    private readonly maintenanceWindows: MaintenanceWindowsServerStart | undefined,
    private readonly basePath: IBasePath,
    private readonly logger: LoggerServiceContract
  ) {}

  public async getActiveMaintenanceWindowSpaceIds(spaceIds: string[]): Promise<Set<string>> {
    if (!this.maintenanceWindows || spaceIds.length === 0) {
      return new Set();
    }

    const activeSpaceIds = new Set<string>();
    const now = Date.now();
    const spacesToQuery: string[] = [];

    for (const spaceId of spaceIds) {
      const cached = this.cache.get(spaceId);
      if (cached && now - cached.lastUpdated < CACHE_INTERVAL_MS) {
        if (cached.hasActive) {
          activeSpaceIds.add(spaceId);
        }
      } else {
        spacesToQuery.push(spaceId);
      }
    }

    if (spacesToQuery.length === 0) {
      return activeSpaceIds;
    }

    const mwPlugin = this.maintenanceWindows;
    const limiter = pLimit(MAX_CONCURRENT_QUERIES);

    await Promise.all(
      spacesToQuery.map((spaceId) =>
        limiter(async () => {
          try {
            const path = addSpaceIdToPath('/', spaceId);

            const fakeRawRequest: FakeRawRequest = {
              headers: {},
              path,
            };

            const fakeRequest = kibanaRequestFactory(fakeRawRequest);
            this.basePath.set(fakeRequest, path);

            const client = mwPlugin.getMaintenanceWindowClientWithoutAuth(fakeRequest);
            const activeWindows = await client.getActiveMaintenanceWindows(CACHE_INTERVAL_MS);
            const hasActive = activeWindows.length > 0;

            this.cache.set(spaceId, { lastUpdated: Date.now(), hasActive });

            if (hasActive) {
              activeSpaceIds.add(spaceId);
            }
          } catch (e) {
            // Fail-open: if MW check fails, fall back to cached value or treat as no active MWs
            const cached = this.cache.get(spaceId);
            if (cached?.hasActive) {
              activeSpaceIds.add(spaceId);
            }

            this.logger.warn({
              message: () =>
                `Failed to fetch active maintenance windows for space "${spaceId}": ${e.message}`,
            });
          }
        })
      )
    );

    return activeSpaceIds;
  }
}
