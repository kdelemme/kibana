/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { i18n } from '@kbn/i18n';
import {
  SecurityPageName,
  SECURITY_FEATURE_ID,
  ENTITY_ANALYTICS_LANDING_PATH,
  ENTITY_ANALYTICS_PRIVILEGED_USER_MONITORING_PATH,
} from '../../common/constants';
import type { LinkItem } from '../common/links/types';
import { ENTITY_ANALYTICS, ENTITY_ANALYTICS_PRIVILEGED_USER_MONITORING } from '../app/translations';
import privilegedUserMonitoringPageImg from '../common/images/privileged_user_monitoring_page.png';

const privMonLinks: LinkItem = {
  id: SecurityPageName.privilegedUserMonitoring,
  title: ENTITY_ANALYTICS_PRIVILEGED_USER_MONITORING,
  landingImage: privilegedUserMonitoringPageImg,
  description: i18n.translate(
    'xpack.securitySolution.appLinks.privilegedUserMonitoring.Description',
    {
      defaultMessage: '???????????????????', // TODO
    }
  ),
  path: ENTITY_ANALYTICS_PRIVILEGED_USER_MONITORING_PATH,
  globalSearchKeywords: [
    i18n.translate('xpack.securitySolution.appLinks.privilegedUserMonitoring', {
      defaultMessage: 'Privileged User Monitoring',
    }),
  ],
  experimentalKey: 'privilegeMonitoringEnabled',
  hideTimeline: true,
  skipUrlState: true,
  capabilities: [`${SECURITY_FEATURE_ID}.entity-analytics`],
  licenseType: 'platinum',
};

export const entityAnalyticsLinks: LinkItem = {
  id: SecurityPageName.entityAnalyticsLanding,
  title: ENTITY_ANALYTICS,
  path: ENTITY_ANALYTICS_LANDING_PATH,
  globalNavPosition: 10,
  globalSearchKeywords: [
    i18n.translate('xpack.securitySolution.appLinks.entityAnalytics.landing', {
      defaultMessage: 'Entity Analytics',
    }),
  ],
  links: [privMonLinks],
  hideTimeline: true,
  skipUrlState: true,
  experimentalKey: 'privilegeMonitoringEnabled',
  capabilities: [`${SECURITY_FEATURE_ID}.entity-analytics`],
  licenseType: 'platinum',
};
