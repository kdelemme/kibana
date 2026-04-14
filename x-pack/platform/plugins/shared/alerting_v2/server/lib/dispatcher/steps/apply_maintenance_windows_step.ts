/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { inject, injectable } from 'inversify';
import {
  LoggerServiceToken,
  type LoggerServiceContract,
} from '../../services/logger_service/logger_service';
import type { MaintenanceWindowServiceContract } from '../../services/maintenance_window_service/maintenance_window_service';
import { MaintenanceWindowServiceToken } from '../../services/maintenance_window_service/tokens';
import type {
  DispatcherPipelineState,
  DispatcherStep,
  DispatcherStepOutput,
  NotificationPolicy,
  NotificationPolicyId,
} from '../types';

@injectable()
export class ApplyMaintenanceWindowsStep implements DispatcherStep {
  public readonly name = 'apply_maintenance_windows';

  constructor(
    @inject(MaintenanceWindowServiceToken)
    private readonly maintenanceWindowService: MaintenanceWindowServiceContract,
    @inject(LoggerServiceToken) private readonly logger: LoggerServiceContract
  ) {}

  public async execute(state: Readonly<DispatcherPipelineState>): Promise<DispatcherStepOutput> {
    const { policies = new Map() } = state;

    const spaceIds = new Set<string>();
    for (const policy of policies.values()) {
      if (policy.followMaintenanceWindows !== false) {
        spaceIds.add(policy.spaceId);
      }
    }

    if (spaceIds.size === 0) {
      return { type: 'continue' };
    }

    const activeMaintenanceWindowSpaceIds =
      await this.maintenanceWindowService.getActiveMaintenanceWindowSpaceIds([...spaceIds]);

    if (activeMaintenanceWindowSpaceIds.size === 0) {
      return { type: 'continue' };
    }

    const filteredPolicies = new Map<NotificationPolicyId, NotificationPolicy>();

    for (const [id, policy] of policies) {
      if (
        policy.followMaintenanceWindows !== false &&
        activeMaintenanceWindowSpaceIds.has(policy.spaceId)
      ) {
        this.logger.debug({
          message: () =>
            `Policy "${id}" suppressed due to active maintenance window in space "${policy.spaceId}"`,
        });
      } else {
        filteredPolicies.set(id, policy);
      }
    }

    return {
      type: 'continue',
      data: { policies: filteredPolicies },
    };
  }
}
