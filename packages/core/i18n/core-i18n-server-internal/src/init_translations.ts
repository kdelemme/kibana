/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import { i18n, i18nLoader } from '@kbn/i18n';

export const initTranslations = async (locale: string, translationFiles: string[]) => {
  i18nLoader.registerTranslationFiles(translationFiles);
  const translations = await i18nLoader.getTranslationsByLocale(locale);
  translations.locale = locale;
  i18n.init(translations);
};
