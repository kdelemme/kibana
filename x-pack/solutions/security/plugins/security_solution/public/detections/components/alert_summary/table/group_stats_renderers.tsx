/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import type { GroupStatsItem, RawBucket } from '@kbn/grouping';
import React from 'react';
import { i18n } from '@kbn/i18n';
import { IntegrationIcon } from '../common/integration_icon';
import { getRulesBadge, getSeverityComponent } from '../../alerts_table/grouping_settings';
import { DEFAULT_GROUP_STATS_RENDERER } from '../../alerts_table/alerts_grouping';
import type { AlertsGroupingAggregation } from '../../alerts_table/grouping_settings/types';

const STATS_GROUP_SIGNAL_RULE_ID = i18n.translate(
  'xpack.securitySolution.alertSummary.groups.integrations',
  {
    defaultMessage: 'Integrations:',
  }
);
const STATS_GROUP_SIGNAL_RULE_ID_MULTI = i18n.translate(
  'xpack.securitySolution.alertSummary.groups.integrations.multi',
  {
    defaultMessage: ' Multi',
  }
);

/**
 * Return a renderer for integration aggregation.
 */
export const getIntegrationComponent = (
  bucket: RawBucket<AlertsGroupingAggregation>
): GroupStatsItem[] => {
  const signalRuleIds = bucket.signalRuleIdSubAggregation?.buckets;

  if (!signalRuleIds || signalRuleIds.length === 0) {
    return [];
  }

  if (signalRuleIds.length === 1) {
    const ruleId = Array.isArray(signalRuleIds[0].key)
      ? signalRuleIds[0].key[0]
      : signalRuleIds[0].key;
    return [
      {
        title: STATS_GROUP_SIGNAL_RULE_ID,
        component: <IntegrationIcon ruleId={ruleId} />,
      },
    ];
  }

  return [
    {
      title: STATS_GROUP_SIGNAL_RULE_ID,
      component: <>{STATS_GROUP_SIGNAL_RULE_ID_MULTI}</>,
    },
  ];
};

/**
 * Returns stats to be used in the`extraAction` property of the EuiAccordion component used within the kbn-grouping package.
 * It handles custom renders for the following fields:
 * - signal.rule.id
 * - kibana.alert.severity
 * - kibana.alert.rule.name
 * And returns a default view for all the other fields.
 *
 * These go hand in hand with groupingOptions, groupTitleRenderers and groupStatsAggregations.
 */
export const groupStatsRenderer = (
  selectedGroup: string,
  bucket: RawBucket<AlertsGroupingAggregation>
): GroupStatsItem[] => {
  const defaultBadges: GroupStatsItem[] = DEFAULT_GROUP_STATS_RENDERER(selectedGroup, bucket);
  const severityComponent: GroupStatsItem[] = getSeverityComponent(bucket);
  const integrationComponent: GroupStatsItem[] = getIntegrationComponent(bucket);
  const rulesBadge: GroupStatsItem = getRulesBadge(bucket);

  switch (selectedGroup) {
    case 'signal.rule.id':
      return [...severityComponent, rulesBadge, ...defaultBadges];
    case 'kibana.alert.severity':
      return [...integrationComponent, rulesBadge, ...defaultBadges];
    case 'kibana.alert.rule.name':
      return [...integrationComponent, ...severityComponent, ...defaultBadges];
    default:
      return [...integrationComponent, ...severityComponent, rulesBadge, ...defaultBadges];
  }
};
