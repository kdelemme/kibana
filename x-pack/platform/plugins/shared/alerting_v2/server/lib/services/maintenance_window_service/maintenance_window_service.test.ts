/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import type { IBasePath } from '@kbn/core/server';
import type { MaintenanceWindowsServerStart } from '@kbn/maintenance-windows-plugin/server';
import { createLoggerService } from '../logger_service/logger_service.mock';
import { MaintenanceWindowService } from './maintenance_window_service';

const createMockBasePath = (): jest.Mocked<IBasePath> =>
  ({
    set: jest.fn(),
    get: jest.fn().mockReturnValue('/'),
    remove: jest.fn(),
    serverBasePath: '/',
    publicBaseUrl: undefined,
  } as unknown as jest.Mocked<IBasePath>);

const createMockMwStart = (): jest.Mocked<MaintenanceWindowsServerStart> => ({
  getMaintenanceWindowClientInternal: jest.fn(),
  getMaintenanceWindowClientWithAuth: jest.fn(),
  getMaintenanceWindowClientWithoutAuth: jest.fn(),
});

describe('MaintenanceWindowService', () => {
  afterEach(() => jest.clearAllMocks());

  it('returns empty set when maintenance windows plugin is unavailable', async () => {
    const { loggerService } = createLoggerService();
    const basePath = createMockBasePath();
    const service = new MaintenanceWindowService(undefined, basePath, loggerService);

    const result = await service.getActiveMaintenanceWindowSpaceIds(['default']);

    expect(result.size).toBe(0);
  });

  it('returns empty set when no space IDs are provided', async () => {
    const { loggerService } = createLoggerService();
    const basePath = createMockBasePath();
    const mwStart = createMockMwStart();
    const service = new MaintenanceWindowService(mwStart, basePath, loggerService);

    const result = await service.getActiveMaintenanceWindowSpaceIds([]);

    expect(result.size).toBe(0);
    expect(mwStart.getMaintenanceWindowClientWithoutAuth).not.toHaveBeenCalled();
  });

  it('returns space IDs with active maintenance windows', async () => {
    const { loggerService } = createLoggerService();
    const basePath = createMockBasePath();
    const mwStart = createMockMwStart();

    const mockClient = {
      getActiveMaintenanceWindows: jest.fn(),
    };

    mwStart.getMaintenanceWindowClientWithoutAuth.mockReturnValue(mockClient as any);

    mockClient.getActiveMaintenanceWindows
      .mockResolvedValueOnce([{ id: 'mw-1', title: 'MW 1' }])
      .mockResolvedValueOnce([]);

    const service = new MaintenanceWindowService(mwStart, basePath, loggerService);

    const result = await service.getActiveMaintenanceWindowSpaceIds(['space-a', 'space-b']);

    expect(result).toEqual(new Set(['space-a']));
    expect(mwStart.getMaintenanceWindowClientWithoutAuth).toHaveBeenCalledTimes(2);
    expect(basePath.set).toHaveBeenCalledTimes(2);
  });

  it('sets the correct base path for each space', async () => {
    const { loggerService } = createLoggerService();
    const basePath = createMockBasePath();
    const mwStart = createMockMwStart();

    const mockClient = {
      getActiveMaintenanceWindows: jest.fn().mockResolvedValue([]),
    };
    mwStart.getMaintenanceWindowClientWithoutAuth.mockReturnValue(mockClient as any);

    const service = new MaintenanceWindowService(mwStart, basePath, loggerService);

    await service.getActiveMaintenanceWindowSpaceIds(['default', 'my-space']);

    const setPathCalls = basePath.set.mock.calls.map((call) => call[1]);
    expect(setPathCalls).toContain('/');
    expect(setPathCalls).toContain('/s/my-space');
  });

  it('handles errors gracefully and falls back to cached value', async () => {
    const { loggerService } = createLoggerService();
    const basePath = createMockBasePath();
    const mwStart = createMockMwStart();

    const mockClient = {
      getActiveMaintenanceWindows: jest.fn(),
    };
    mwStart.getMaintenanceWindowClientWithoutAuth.mockReturnValue(mockClient as any);

    mockClient.getActiveMaintenanceWindows
      .mockResolvedValueOnce([{ id: 'mw-1', title: 'MW 1' }])
      .mockResolvedValueOnce([{ id: 'mw-2', title: 'MW 2' }]);

    const service = new MaintenanceWindowService(mwStart, basePath, loggerService);

    // First call populates cache
    const result1 = await service.getActiveMaintenanceWindowSpaceIds(['space-a', 'space-b']);
    expect(result1).toEqual(new Set(['space-a', 'space-b']));

    // Expire cache by advancing time
    jest.spyOn(Date, 'now').mockReturnValue(Date.now() + 61_000);

    // Second call: space-a fails, should fall back to cached value (hasActive: true)
    mockClient.getActiveMaintenanceWindows
      .mockRejectedValueOnce(new Error('network error'))
      .mockResolvedValueOnce([]);

    const result2 = await service.getActiveMaintenanceWindowSpaceIds(['space-a', 'space-b']);
    expect(result2).toEqual(new Set(['space-a']));

    jest.restoreAllMocks();
  });

  it('serves cached results without querying', async () => {
    const { loggerService } = createLoggerService();
    const basePath = createMockBasePath();
    const mwStart = createMockMwStart();

    const mockClient = {
      getActiveMaintenanceWindows: jest.fn().mockResolvedValue([{ id: 'mw-1' }]),
    };
    mwStart.getMaintenanceWindowClientWithoutAuth.mockReturnValue(mockClient as any);

    const service = new MaintenanceWindowService(mwStart, basePath, loggerService);

    await service.getActiveMaintenanceWindowSpaceIds(['space-a']);
    expect(mockClient.getActiveMaintenanceWindows).toHaveBeenCalledTimes(1);

    // Second call within cache window should not query
    const result = await service.getActiveMaintenanceWindowSpaceIds(['space-a']);
    expect(result).toEqual(new Set(['space-a']));
    expect(mockClient.getActiveMaintenanceWindows).toHaveBeenCalledTimes(1);
  });

  it('passes cacheIntervalMs to getActiveMaintenanceWindows', async () => {
    const { loggerService } = createLoggerService();
    const basePath = createMockBasePath();
    const mwStart = createMockMwStart();

    const mockClient = {
      getActiveMaintenanceWindows: jest.fn().mockResolvedValue([]),
    };
    mwStart.getMaintenanceWindowClientWithoutAuth.mockReturnValue(mockClient as any);

    const service = new MaintenanceWindowService(mwStart, basePath, loggerService);

    await service.getActiveMaintenanceWindowSpaceIds(['default']);

    expect(mockClient.getActiveMaintenanceWindows).toHaveBeenCalledWith(60_000);
  });
});
