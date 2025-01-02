/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { defaultConfig } from '@kbn/storybook';

module.exports = {
  ...defaultConfig,
  stories: [
    '../**/*.stories.tsx',
    '../../../../../platform/packages/shared/ai-assistant/**/*.stories.tsx',
  ],
  reactOptions: {
    strictMode: true,
  },
};
