/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import React from 'react';

import { ALERT_REASON, SYNTHETICS_ALERT_RULE_TYPES } from '@kbn/rule-data-utils';

import type { ObservabilityRuleTypeModel } from '@kbn/observability-plugin/public';
import type { RuleTypeParamsExpressionProps } from '@kbn/triggers-actions-ui-plugin/public';
import { SyntheticsMonitorStatusRuleParams as StatusRuleParams } from '@kbn/response-ops-rule-params/synthetics_monitor_status';
import { getSyntheticsErrorRouteFromMonitorId } from '../../../../../common/utils/get_synthetics_monitor_url';
import { STATE_ID } from '../../../../../common/field_names';
import { SyntheticsMonitorStatusTranslations } from '../../../../../common/rules/synthetics/translations';
import type { AlertTypeInitializer } from './types';

const { defaultActionMessage, defaultRecoveryMessage, description } =
  SyntheticsMonitorStatusTranslations;

const MonitorStatusAlert = React.lazy(() => import('./lazy_wrapper/monitor_status'));

export const initMonitorStatusAlertType: AlertTypeInitializer = ({
  core,
  plugins,
}): ObservabilityRuleTypeModel => ({
  id: SYNTHETICS_ALERT_RULE_TYPES.MONITOR_STATUS,
  description,
  iconClass: 'uptimeApp',
  documentationUrl(docLinks) {
    return `${docLinks.links.observability.syntheticsAlerting}`;
  },
  ruleParamsExpression: (paramProps: RuleTypeParamsExpressionProps<StatusRuleParams>) => (
    <MonitorStatusAlert coreStart={core} plugins={plugins} params={paramProps} />
  ),
  validate: (_ruleParams: StatusRuleParams) => {
    return { errors: {} };
  },
  defaultActionMessage,
  defaultRecoveryMessage,
  requiresAppContext: false,
  format: ({ fields }) => {
    return {
      reason: fields[ALERT_REASON] || '',
      link: getSyntheticsErrorRouteFromMonitorId({
        configId: fields.configId,
        locationId: fields['location.id'],
        stateId: fields[STATE_ID],
      }),
    };
  },
});
