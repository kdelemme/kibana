/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import React from 'react';
import { i18n } from '@kbn/i18n';
import { Markdown } from '@kbn/shared-ux-markdown';

// DO NOT RENAME!
export const functions = {
  label: i18n.translate('languageDocumentation.documentationESQL.groupingFunctions', {
    defaultMessage: 'Grouping functions',
  }),
  description: i18n.translate(
    'languageDocumentation.documentationESQL.groupingFunctionsDocumentationESQLDescription',
    {
      defaultMessage: `These grouping functions can be used with \`STATS...BY\`:`,
    }
  ),
  // items are managed by scripts/generate_esql_docs.ts
  items: [
    // Do not edit manually... automatically generated by scripts/generate_esql_docs.ts
    {
      label: i18n.translate('languageDocumentation.documentationESQL.bucket', {
        defaultMessage: 'BUCKET',
      }),
      preview: false,
      description: (
        <Markdown
          openLinksInNewTab
          readOnly
          enableSoftLineBreaks
          markdownContent={i18n.translate(
            'languageDocumentation.documentationESQL.bucket.markdown',
            {
              defaultMessage: `<!--
  This is generated by ESQL's AbstractFunctionTestCase. Do no edit it. See ../README.md for how to regenerate it.
  -->

  ### BUCKET
  Creates groups of values - buckets - out of a datetime or numeric input.
  The size of the buckets can either be provided directly, or chosen based on a recommended count and values range.

  \`\`\` esql
  FROM employees
  | WHERE hire_date >= "1985-01-01T00:00:00Z" AND hire_date < "1986-01-01T00:00:00Z"
  | STATS hire_date = MV_SORT(VALUES(hire_date)) BY month = BUCKET(hire_date, 20, "1985-01-01T00:00:00Z", "1986-01-01T00:00:00Z")
  | SORT hire_date
  \`\`\`
  `,
              description:
                'Text is in markdown. Do not translate function names, special characters, or field names like sum(bytes)',
              ignoreTag: true,
            }
          )}
        />
      ),
    },
    // Do not edit manually... automatically generated by scripts/generate_esql_docs.ts
    {
      label: i18n.translate('languageDocumentation.documentationESQL.categorize', {
        defaultMessage: 'CATEGORIZE',
      }),
      preview: true,
      description: (
        <Markdown
          openLinksInNewTab
          readOnly
          enableSoftLineBreaks
          markdownContent={i18n.translate(
            'languageDocumentation.documentationESQL.categorize.markdown',
            {
              defaultMessage: `<!--
  This is generated by ESQL's AbstractFunctionTestCase. Do no edit it. See ../README.md for how to regenerate it.
  -->

  ### CATEGORIZE
  Groups text messages into categories of similarly formatted text values.

  \`\`\` esql
  FROM sample_data
  | STATS count=COUNT() BY category=CATEGORIZE(message)
  \`\`\`
  `,
              description:
                'Text is in markdown. Do not translate function names, special characters, or field names like sum(bytes)',
              ignoreTag: true,
            }
          )}
        />
      ),
    },
  ],
};
