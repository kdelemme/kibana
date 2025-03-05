/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import React from 'react';
import { SiemMigrationStartUpsellSection as SiemMigrationStartUpsellSectionCommon } from '@kbn/security-solution-upselling/sections/siem_migrations_start';
import * as i18n from '../../translations';

export const SiemMigrationStartUpsellSection = () => {
  return (
    <SiemMigrationStartUpsellSectionCommon
      title={i18n.SIEM_MIGRATION_UPSELLING_TITLE('Complete')}
      upgradeMessage={i18n.SIEM_MIGRATION_UPGRADE_MESSAGE}
    />
  );
};
