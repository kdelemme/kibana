/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { SLO_RESOURCES_VERSION } from '../constants';

export const getSLOMappingsTemplate = (name: string) => ({
  name,
  template: {
    mappings: {
      properties: {
        event: {
          properties: {
            ingested: {
              type: 'date',
              format: 'strict_date_optional_time',
            },
          },
        },
        '@timestamp': {
          type: 'date',
          format: 'date_optional_time||epoch_millis',
        },
        // APM service and transaction specific fields
        service: {
          properties: {
            name: {
              type: 'keyword',
            },
            environment: {
              type: 'keyword',
            },
          },
        },
        transaction: {
          properties: {
            name: {
              type: 'keyword',
            },
            type: {
              type: 'keyword',
            },
          },
        },
        slo: {
          properties: {
            id: {
              type: 'keyword',
              ignore_above: 256,
            },
            revision: {
              type: 'long',
            },
            instanceId: {
              type: 'keyword',
            },
            objective: {
              properties: {
                target: {
                  type: 'double',
                },
                sliceDurationInSeconds: {
                  type: 'long',
                },
              },
            },
            budgetingMethod: {
              type: 'keyword',
            },
            timeWindow: {
              properties: {
                duration: {
                  type: 'keyword',
                },
                type: {
                  type: 'keyword',
                },
              },
            },
            numerator: {
              type: 'long',
            },
            denominator: {
              type: 'long',
            },
            isGoodSlice: {
              type: 'byte',
            },
          },
        },
      },
    },
  },
  _meta: {
    description: 'Mappings for SLO rollup data',
    version: SLO_RESOURCES_VERSION,
    managed: true,
    managed_by: 'observability',
  },
});
