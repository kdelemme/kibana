/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { createTestConfig } from '../../../../../../../config/serverless/config.base';

export default createTestConfig({
  testFiles: [require.resolve('..')],
  junit: {
    reportName:
      'Rules Management - Rule Import Integration Tests - Importing non-customized prebuilt rules - Customization disabled - Serverless Env',
  },
  kbnTestServerArgs: [],
});
