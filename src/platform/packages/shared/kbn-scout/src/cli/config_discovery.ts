/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import fs from 'fs';
import { Command } from '@kbn/dev-cli-runner';
import { SCOUT_PLAYWRIGHT_CONFIGS_PATH } from '@kbn/scout-info';
import path from 'path';
import { getScoutPlaywrightConfigs, DEFAULT_TEST_PATH_PATTERNS } from '../config';
import { measurePerformance } from '../common';

/**
 * Discover Playwright configuration files with Scout tests
 */
export const discoverPlaywrightConfigs: Command<void> = {
  name: 'discover-playwright-configs',
  description: `
  Discover Playwright configuration files with Scout tests.

  Common usage:
    node scripts/scout discover-playwright-configs --searchPaths <search_paths>
    node scripts/scout discover-playwright-configs --save
    node scripts/scout discover-playwright-configs
  `,
  flags: {
    string: ['searchPaths'],
    boolean: ['save'],
    default: { searchPaths: DEFAULT_TEST_PATH_PATTERNS, save: false },
  },
  run: ({ flagsReader, log }) => {
    const searchPaths = flagsReader.arrayOfStrings('searchPaths')!;

    const pluginsMap = measurePerformance(log, 'Discovering playwright config files', () => {
      return getScoutPlaywrightConfigs(searchPaths, log);
    });

    const finalMessage =
      pluginsMap.size === 0
        ? 'No Playwright config files found'
        : `Found Playwright config files in '${pluginsMap.size}' plugins`;

    if (flagsReader.boolean('save')) {
      const dirPath = path.dirname(SCOUT_PLAYWRIGHT_CONFIGS_PATH);

      if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
      }

      fs.writeFileSync(
        SCOUT_PLAYWRIGHT_CONFIGS_PATH,
        JSON.stringify(Object.fromEntries(pluginsMap), null, 2)
      );

      log.info(`${finalMessage}. Saved to '${SCOUT_PLAYWRIGHT_CONFIGS_PATH}'`);
      return;
    }

    log.info(finalMessage);

    pluginsMap.forEach((data, plugin) => {
      log.info(`${data.group} / [${plugin}] plugin:`);
      data.configs.map((file) => {
        log.info(`- ${file}`);
      });
    });
  },
};
