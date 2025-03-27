/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

/**
 * __AUTOGENERATED FILE. DO NOT EDIT THIS FILE DIRECTLY.__
 *
 * @note This file is generated by the `generate_function_definitions.ts`
 * script. Do not edit it manually.
 *
 *
 *
 *
 *
 *
 *
 *
 *
 *
 *
 *
 */

import { i18n } from '@kbn/i18n';
import { type FunctionDefinition, FunctionDefinitionTypes, Location } from '../types';

// Do not edit this manually... generated by scripts/generate_function_definitions.ts
const bucketDefinition: FunctionDefinition = {
  type: FunctionDefinitionTypes.GROUPING,
  name: 'bucket',
  description: i18n.translate('kbn-esql-validation-autocomplete.esql.definitions.bucket', {
    defaultMessage:
      'Creates groups of values - buckets - out of a datetime or numeric input.\nThe size of the buckets can either be provided directly, or chosen based on a recommended count and values range.',
  }),
  preview: false,
  alias: undefined,
  signatures: [
    {
      params: [
        {
          name: 'field',
          type: 'date',
        },
        {
          name: 'buckets',
          type: 'date_period',
          constantOnly: true,
        },
      ],
      returnType: 'date',
    },
    {
      params: [
        {
          name: 'field',
          type: 'date',
        },
        {
          name: 'buckets',
          type: 'integer',
          constantOnly: true,
        },
        {
          name: 'startDate',
          type: 'date',
          constantOnly: true,
        },
        {
          name: 'endDate',
          type: 'date',
          constantOnly: true,
        },
      ],
      returnType: 'date',
    },
    {
      params: [
        {
          name: 'field',
          type: 'date_nanos',
        },
        {
          name: 'buckets',
          type: 'date_period',
          constantOnly: true,
        },
      ],
      returnType: 'date_nanos',
    },
    {
      params: [
        {
          name: 'field',
          type: 'date_nanos',
        },
        {
          name: 'buckets',
          type: 'integer',
          constantOnly: true,
        },
        {
          name: 'startDate',
          type: 'date',
          constantOnly: true,
        },
        {
          name: 'endDate',
          type: 'date',
          constantOnly: true,
        },
      ],
      returnType: 'date_nanos',
    },
    {
      params: [
        {
          name: 'field',
          type: 'date',
        },
        {
          name: 'buckets',
          type: 'time_literal',
          constantOnly: true,
        },
      ],
      returnType: 'date',
    },
    {
      params: [
        {
          name: 'field',
          type: 'double',
        },
        {
          name: 'buckets',
          type: 'double',
          constantOnly: true,
        },
      ],
      returnType: 'double',
    },
    {
      params: [
        {
          name: 'field',
          type: 'double',
        },
        {
          name: 'buckets',
          type: 'integer',
          constantOnly: true,
        },
        {
          name: 'startDate',
          type: 'double',
          constantOnly: true,
        },
        {
          name: 'endDate',
          type: 'double',
          constantOnly: true,
        },
      ],
      returnType: 'double',
    },
    {
      params: [
        {
          name: 'field',
          type: 'double',
        },
        {
          name: 'buckets',
          type: 'integer',
          constantOnly: true,
        },
        {
          name: 'startDate',
          type: 'double',
          constantOnly: true,
        },
        {
          name: 'endDate',
          type: 'integer',
          constantOnly: true,
        },
      ],
      returnType: 'double',
    },
    {
      params: [
        {
          name: 'field',
          type: 'double',
        },
        {
          name: 'buckets',
          type: 'integer',
          constantOnly: true,
        },
        {
          name: 'startDate',
          type: 'double',
          constantOnly: true,
        },
        {
          name: 'endDate',
          type: 'long',
          constantOnly: true,
        },
      ],
      returnType: 'double',
    },
    {
      params: [
        {
          name: 'field',
          type: 'double',
        },
        {
          name: 'buckets',
          type: 'integer',
          constantOnly: true,
        },
        {
          name: 'startDate',
          type: 'integer',
          constantOnly: true,
        },
        {
          name: 'endDate',
          type: 'double',
          constantOnly: true,
        },
      ],
      returnType: 'double',
    },
    {
      params: [
        {
          name: 'field',
          type: 'double',
        },
        {
          name: 'buckets',
          type: 'integer',
          constantOnly: true,
        },
        {
          name: 'startDate',
          type: 'integer',
          constantOnly: true,
        },
        {
          name: 'endDate',
          type: 'integer',
          constantOnly: true,
        },
      ],
      returnType: 'double',
    },
    {
      params: [
        {
          name: 'field',
          type: 'double',
        },
        {
          name: 'buckets',
          type: 'integer',
          constantOnly: true,
        },
        {
          name: 'startDate',
          type: 'integer',
          constantOnly: true,
        },
        {
          name: 'endDate',
          type: 'long',
          constantOnly: true,
        },
      ],
      returnType: 'double',
    },
    {
      params: [
        {
          name: 'field',
          type: 'double',
        },
        {
          name: 'buckets',
          type: 'integer',
          constantOnly: true,
        },
        {
          name: 'startDate',
          type: 'long',
          constantOnly: true,
        },
        {
          name: 'endDate',
          type: 'double',
          constantOnly: true,
        },
      ],
      returnType: 'double',
    },
    {
      params: [
        {
          name: 'field',
          type: 'double',
        },
        {
          name: 'buckets',
          type: 'integer',
          constantOnly: true,
        },
        {
          name: 'startDate',
          type: 'long',
          constantOnly: true,
        },
        {
          name: 'endDate',
          type: 'integer',
          constantOnly: true,
        },
      ],
      returnType: 'double',
    },
    {
      params: [
        {
          name: 'field',
          type: 'double',
        },
        {
          name: 'buckets',
          type: 'integer',
          constantOnly: true,
        },
        {
          name: 'startDate',
          type: 'long',
          constantOnly: true,
        },
        {
          name: 'endDate',
          type: 'long',
          constantOnly: true,
        },
      ],
      returnType: 'double',
    },
    {
      params: [
        {
          name: 'field',
          type: 'integer',
        },
        {
          name: 'buckets',
          type: 'double',
          constantOnly: true,
        },
      ],
      returnType: 'double',
    },
    {
      params: [
        {
          name: 'field',
          type: 'integer',
        },
        {
          name: 'buckets',
          type: 'integer',
          constantOnly: true,
        },
        {
          name: 'startDate',
          type: 'double',
          constantOnly: true,
        },
        {
          name: 'endDate',
          type: 'double',
          constantOnly: true,
        },
      ],
      returnType: 'double',
    },
    {
      params: [
        {
          name: 'field',
          type: 'integer',
        },
        {
          name: 'buckets',
          type: 'integer',
          constantOnly: true,
        },
        {
          name: 'startDate',
          type: 'double',
          constantOnly: true,
        },
        {
          name: 'endDate',
          type: 'integer',
          constantOnly: true,
        },
      ],
      returnType: 'double',
    },
    {
      params: [
        {
          name: 'field',
          type: 'integer',
        },
        {
          name: 'buckets',
          type: 'integer',
          constantOnly: true,
        },
        {
          name: 'startDate',
          type: 'double',
          constantOnly: true,
        },
        {
          name: 'endDate',
          type: 'long',
          constantOnly: true,
        },
      ],
      returnType: 'double',
    },
    {
      params: [
        {
          name: 'field',
          type: 'integer',
        },
        {
          name: 'buckets',
          type: 'integer',
          constantOnly: true,
        },
        {
          name: 'startDate',
          type: 'integer',
          constantOnly: true,
        },
        {
          name: 'endDate',
          type: 'double',
          constantOnly: true,
        },
      ],
      returnType: 'double',
    },
    {
      params: [
        {
          name: 'field',
          type: 'integer',
        },
        {
          name: 'buckets',
          type: 'integer',
          constantOnly: true,
        },
        {
          name: 'startDate',
          type: 'integer',
          constantOnly: true,
        },
        {
          name: 'endDate',
          type: 'integer',
          constantOnly: true,
        },
      ],
      returnType: 'double',
    },
    {
      params: [
        {
          name: 'field',
          type: 'integer',
        },
        {
          name: 'buckets',
          type: 'integer',
          constantOnly: true,
        },
        {
          name: 'startDate',
          type: 'integer',
          constantOnly: true,
        },
        {
          name: 'endDate',
          type: 'long',
          constantOnly: true,
        },
      ],
      returnType: 'double',
    },
    {
      params: [
        {
          name: 'field',
          type: 'integer',
        },
        {
          name: 'buckets',
          type: 'integer',
          constantOnly: true,
        },
        {
          name: 'startDate',
          type: 'long',
          constantOnly: true,
        },
        {
          name: 'endDate',
          type: 'double',
          constantOnly: true,
        },
      ],
      returnType: 'double',
    },
    {
      params: [
        {
          name: 'field',
          type: 'integer',
        },
        {
          name: 'buckets',
          type: 'integer',
          constantOnly: true,
        },
        {
          name: 'startDate',
          type: 'long',
          constantOnly: true,
        },
        {
          name: 'endDate',
          type: 'integer',
          constantOnly: true,
        },
      ],
      returnType: 'double',
    },
    {
      params: [
        {
          name: 'field',
          type: 'integer',
        },
        {
          name: 'buckets',
          type: 'integer',
          constantOnly: true,
        },
        {
          name: 'startDate',
          type: 'long',
          constantOnly: true,
        },
        {
          name: 'endDate',
          type: 'long',
          constantOnly: true,
        },
      ],
      returnType: 'double',
    },
    {
      params: [
        {
          name: 'field',
          type: 'long',
        },
        {
          name: 'buckets',
          type: 'double',
          constantOnly: true,
        },
      ],
      returnType: 'double',
    },
    {
      params: [
        {
          name: 'field',
          type: 'long',
        },
        {
          name: 'buckets',
          type: 'integer',
          constantOnly: true,
        },
        {
          name: 'startDate',
          type: 'double',
          constantOnly: true,
        },
        {
          name: 'endDate',
          type: 'double',
          constantOnly: true,
        },
      ],
      returnType: 'double',
    },
    {
      params: [
        {
          name: 'field',
          type: 'long',
        },
        {
          name: 'buckets',
          type: 'integer',
          constantOnly: true,
        },
        {
          name: 'startDate',
          type: 'double',
          constantOnly: true,
        },
        {
          name: 'endDate',
          type: 'integer',
          constantOnly: true,
        },
      ],
      returnType: 'double',
    },
    {
      params: [
        {
          name: 'field',
          type: 'long',
        },
        {
          name: 'buckets',
          type: 'integer',
          constantOnly: true,
        },
        {
          name: 'startDate',
          type: 'double',
          constantOnly: true,
        },
        {
          name: 'endDate',
          type: 'long',
          constantOnly: true,
        },
      ],
      returnType: 'double',
    },
    {
      params: [
        {
          name: 'field',
          type: 'long',
        },
        {
          name: 'buckets',
          type: 'integer',
          constantOnly: true,
        },
        {
          name: 'startDate',
          type: 'integer',
          constantOnly: true,
        },
        {
          name: 'endDate',
          type: 'double',
          constantOnly: true,
        },
      ],
      returnType: 'double',
    },
    {
      params: [
        {
          name: 'field',
          type: 'long',
        },
        {
          name: 'buckets',
          type: 'integer',
          constantOnly: true,
        },
        {
          name: 'startDate',
          type: 'integer',
          constantOnly: true,
        },
        {
          name: 'endDate',
          type: 'integer',
          constantOnly: true,
        },
      ],
      returnType: 'double',
    },
    {
      params: [
        {
          name: 'field',
          type: 'long',
        },
        {
          name: 'buckets',
          type: 'integer',
          constantOnly: true,
        },
        {
          name: 'startDate',
          type: 'integer',
          constantOnly: true,
        },
        {
          name: 'endDate',
          type: 'long',
          constantOnly: true,
        },
      ],
      returnType: 'double',
    },
    {
      params: [
        {
          name: 'field',
          type: 'long',
        },
        {
          name: 'buckets',
          type: 'integer',
          constantOnly: true,
        },
        {
          name: 'startDate',
          type: 'long',
          constantOnly: true,
        },
        {
          name: 'endDate',
          type: 'double',
          constantOnly: true,
        },
      ],
      returnType: 'double',
    },
    {
      params: [
        {
          name: 'field',
          type: 'long',
        },
        {
          name: 'buckets',
          type: 'integer',
          constantOnly: true,
        },
        {
          name: 'startDate',
          type: 'long',
          constantOnly: true,
        },
        {
          name: 'endDate',
          type: 'integer',
          constantOnly: true,
        },
      ],
      returnType: 'double',
    },
    {
      params: [
        {
          name: 'field',
          type: 'long',
        },
        {
          name: 'buckets',
          type: 'integer',
          constantOnly: true,
        },
        {
          name: 'startDate',
          type: 'long',
          constantOnly: true,
        },
        {
          name: 'endDate',
          type: 'long',
          constantOnly: true,
        },
      ],
      returnType: 'double',
    },
  ],
  locationsAvailable: [Location.STATS, Location.STATS_BY],
  validate: undefined,
  examples: [
    'FROM employees\n| WHERE hire_date >= "1985-01-01T00:00:00Z" AND hire_date < "1986-01-01T00:00:00Z"\n| STATS hire_date = MV_SORT(VALUES(hire_date)) BY month = BUCKET(hire_date, 20, "1985-01-01T00:00:00Z", "1986-01-01T00:00:00Z")\n| SORT hire_date',
    'FROM employees\n| WHERE hire_date >= "1985-01-01T00:00:00Z" AND hire_date < "1986-01-01T00:00:00Z"\n| STATS hires_per_month = COUNT(*) BY month = BUCKET(hire_date, 20, "1985-01-01T00:00:00Z", "1986-01-01T00:00:00Z")\n| SORT month',
    'FROM employees\n| WHERE hire_date >= "1985-01-01T00:00:00Z" AND hire_date < "1986-01-01T00:00:00Z"\n| STATS hires_per_week = COUNT(*) BY week = BUCKET(hire_date, 100, "1985-01-01T00:00:00Z", "1986-01-01T00:00:00Z")\n| SORT week',
    'FROM employees\n| WHERE hire_date >= "1985-01-01T00:00:00Z" AND hire_date < "1986-01-01T00:00:00Z"\n| STATS hires_per_week = COUNT(*) BY week = BUCKET(hire_date, 1 week)\n| SORT week',
    'FROM employees\n| STATS COUNT(*) by bs = BUCKET(salary, 20, 25324, 74999)\n| SORT bs',
    'FROM employees\n| WHERE hire_date >= "1985-01-01T00:00:00Z" AND hire_date < "1986-01-01T00:00:00Z"\n| STATS c = COUNT(1) BY b = BUCKET(salary, 5000.)\n| SORT b',
    'FROM sample_data\n| WHERE @timestamp >= NOW() - 1 day and @timestamp < NOW()\n| STATS COUNT(*) BY bucket = BUCKET(@timestamp, 25, NOW() - 1 day, NOW())',
    'FROM employees\n| WHERE hire_date >= "1985-01-01T00:00:00Z" AND hire_date < "1986-01-01T00:00:00Z"\n| STATS AVG(salary) BY bucket = BUCKET(hire_date, 20, "1985-01-01T00:00:00Z", "1986-01-01T00:00:00Z")\n| SORT bucket',
    'FROM employees\n| STATS s1 = b1 + 1, s2 = BUCKET(salary / 1000 + 999, 50.) + 2 BY b1 = BUCKET(salary / 100 + 99, 50.), b2 = BUCKET(salary / 1000 + 999, 50.)\n| SORT b1, b2\n| KEEP s1, b1, s2, b2',
    'FROM employees\n| STATS dates = MV_SORT(VALUES(birth_date)) BY b = BUCKET(birth_date + 1 HOUR, 1 YEAR) - 1 HOUR\n| EVAL d_count = MV_COUNT(dates)\n| SORT d_count, b\n| LIMIT 3',
  ],
};

// Do not edit this manually... generated by scripts/generate_function_definitions.ts
const categorizeDefinition: FunctionDefinition = {
  type: FunctionDefinitionTypes.GROUPING,
  name: 'categorize',
  description: i18n.translate('kbn-esql-validation-autocomplete.esql.definitions.categorize', {
    defaultMessage: 'Groups text messages into categories of similarly formatted text values.',
  }),
  preview: true,
  alias: undefined,
  signatures: [
    {
      params: [
        {
          name: 'field',
          type: 'keyword',
          optional: false,
        },
      ],
      returnType: 'keyword',
    },
    {
      params: [
        {
          name: 'field',
          type: 'text',
          optional: false,
        },
      ],
      returnType: 'keyword',
    },
  ],
  locationsAvailable: [Location.STATS, Location.STATS_BY],
  validate: undefined,
  examples: ['FROM sample_data\n| STATS count=COUNT() BY category=CATEGORIZE(message)'],
};
export const groupingFunctionDefinitions = [bucketDefinition, categorizeDefinition];
