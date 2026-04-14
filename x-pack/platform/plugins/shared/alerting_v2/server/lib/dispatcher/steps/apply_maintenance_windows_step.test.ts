/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { createLoggerService } from '../../services/logger_service/logger_service.mock';
import type { MaintenanceWindowServiceContract } from '../../services/maintenance_window_service/maintenance_window_service';
import { createDispatcherPipelineState, createNotificationPolicy } from '../fixtures/test_utils';
import { ApplyMaintenanceWindowsStep } from './apply_maintenance_windows_step';

const createMockMaintenanceWindowService = (): jest.Mocked<MaintenanceWindowServiceContract> => ({
  getActiveMaintenanceWindowSpaceIds: jest.fn().mockResolvedValue(new Set()),
});

describe('ApplyMaintenanceWindowsStep', () => {
  let mockMwService: jest.Mocked<MaintenanceWindowServiceContract>;

  beforeEach(() => {
    mockMwService = createMockMaintenanceWindowService();
  });

  afterEach(() => jest.clearAllMocks());

  it('returns early when no policies follow maintenance windows', async () => {
    const policy = createNotificationPolicy({
      id: 'p1',
      followMaintenanceWindows: false,
    });
    const policies = new Map([['p1', policy]]);
    const state = createDispatcherPipelineState({ policies });

    const { loggerService } = createLoggerService();
    const step = new ApplyMaintenanceWindowsStep(mockMwService, loggerService);
    const result = await step.execute(state);

    expect(result.type).toBe('continue');
    expect(mockMwService.getActiveMaintenanceWindowSpaceIds).not.toHaveBeenCalled();
  });

  it('returns early when no active maintenance windows exist', async () => {
    const policy = createNotificationPolicy({ id: 'p1', followMaintenanceWindows: true });
    const policies = new Map([['p1', policy]]);
    const state = createDispatcherPipelineState({ policies });

    mockMwService.getActiveMaintenanceWindowSpaceIds.mockResolvedValue(new Set());

    const { loggerService } = createLoggerService();
    const step = new ApplyMaintenanceWindowsStep(mockMwService, loggerService);
    const result = await step.execute(state);

    expect(result.type).toBe('continue');
    if (result.type !== 'continue') return;
    expect(result.data).toBeUndefined();
  });

  it('suppresses policies in spaces with active maintenance windows', async () => {
    const p1 = createNotificationPolicy({ id: 'p1', spaceId: 'space-a' });
    const p2 = createNotificationPolicy({ id: 'p2', spaceId: 'space-b' });
    const policies = new Map([
      ['p1', p1],
      ['p2', p2],
    ]);
    const state = createDispatcherPipelineState({ policies });

    mockMwService.getActiveMaintenanceWindowSpaceIds.mockResolvedValue(new Set(['space-a']));

    const { loggerService } = createLoggerService();
    const step = new ApplyMaintenanceWindowsStep(mockMwService, loggerService);
    const result = await step.execute(state);

    expect(result.type).toBe('continue');
    if (result.type !== 'continue') return;

    expect(result.data?.policies?.size).toBe(1);
    expect(result.data?.policies?.has('p2')).toBe(true);
    expect(result.data?.policies?.has('p1')).toBe(false);
  });

  it('preserves policies with followMaintenanceWindows: false even in MW-active spaces', async () => {
    const p1 = createNotificationPolicy({
      id: 'p1',
      spaceId: 'space-a',
      followMaintenanceWindows: false,
    });
    const p2 = createNotificationPolicy({
      id: 'p2',
      spaceId: 'space-a',
      followMaintenanceWindows: true,
    });
    const policies = new Map([
      ['p1', p1],
      ['p2', p2],
    ]);
    const state = createDispatcherPipelineState({ policies });

    mockMwService.getActiveMaintenanceWindowSpaceIds.mockResolvedValue(new Set(['space-a']));

    const { loggerService } = createLoggerService();
    const step = new ApplyMaintenanceWindowsStep(mockMwService, loggerService);
    const result = await step.execute(state);

    expect(result.type).toBe('continue');
    if (result.type !== 'continue') return;

    expect(result.data?.policies?.size).toBe(1);
    expect(result.data?.policies?.has('p1')).toBe(true);
    expect(result.data?.policies?.has('p2')).toBe(false);
  });

  it('treats undefined followMaintenanceWindows as true (default)', async () => {
    const policy = createNotificationPolicy({
      id: 'p1',
      spaceId: 'default',
      followMaintenanceWindows: undefined,
    });
    const policies = new Map([['p1', policy]]);
    const state = createDispatcherPipelineState({ policies });

    mockMwService.getActiveMaintenanceWindowSpaceIds.mockResolvedValue(new Set(['default']));

    const { loggerService } = createLoggerService();
    const step = new ApplyMaintenanceWindowsStep(mockMwService, loggerService);
    const result = await step.execute(state);

    expect(result.type).toBe('continue');
    if (result.type !== 'continue') return;

    expect(result.data?.policies?.size).toBe(0);
  });

  it('only queries unique space IDs from MW-following policies', async () => {
    const p1 = createNotificationPolicy({ id: 'p1', spaceId: 'space-a' });
    const p2 = createNotificationPolicy({ id: 'p2', spaceId: 'space-a' });
    const p3 = createNotificationPolicy({
      id: 'p3',
      spaceId: 'space-b',
      followMaintenanceWindows: false,
    });
    const policies = new Map([
      ['p1', p1],
      ['p2', p2],
      ['p3', p3],
    ]);
    const state = createDispatcherPipelineState({ policies });

    const { loggerService } = createLoggerService();
    const step = new ApplyMaintenanceWindowsStep(mockMwService, loggerService);
    await step.execute(state);

    expect(mockMwService.getActiveMaintenanceWindowSpaceIds).toHaveBeenCalledWith(['space-a']);
  });

  it('returns early when policies map is empty', async () => {
    const state = createDispatcherPipelineState({ policies: new Map() });

    const { loggerService } = createLoggerService();
    const step = new ApplyMaintenanceWindowsStep(mockMwService, loggerService);
    const result = await step.execute(state);

    expect(result.type).toBe('continue');
    expect(mockMwService.getActiveMaintenanceWindowSpaceIds).not.toHaveBeenCalled();
  });
});
