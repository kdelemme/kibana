/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { FtrConfigProviderContext } from '@kbn/test';

export default async function ({ readConfigFile }: FtrConfigProviderContext) {
  const functionalConfig = await readConfigFile(require.resolve('./config.base.js'));

  return {
    ...functionalConfig.getAll(),

    testFiles: [require.resolve('./apps/upgrade_assistant')],

    junit: {
      reportName: 'Chrome X-Pack UI Upgrade Assistant Functional Tests',
    },

    suiteTags: {
      include: ['upgradeAssistant'],
    },

    esTestCluster: {
      ...functionalConfig.get('esTestCluster'),
      serverArgs: ['path.repo=/tmp/', 'xpack.security.authc.api_key.enabled=true'],
    },
  };
}
