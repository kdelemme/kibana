/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { createTestConfig } from '../../../../../../../config/serverless/config.base.essentials';

export default createTestConfig({
  testFiles: [require.resolve('..')],
  junit: {
    reportName:
      'Rules Management - Rule Import Integration Tests - Importing customized prebuilt rules - Customization enabled - Serverless Env',
  },
  kbnTestServerArgs: [
    `--xpack.securitySolution.enableExperimental=${JSON.stringify([
      'prebuiltRulesCustomizationEnabled',
    ])}`,
  ],
});
