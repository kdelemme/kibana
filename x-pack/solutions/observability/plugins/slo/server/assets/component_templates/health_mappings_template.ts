/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */
import type { ClusterPutComponentTemplateRequest } from '@elastic/elasticsearch/lib/api/types';
import {
  HEALTH_COMPONENT_TEMPLATE_MAPPINGS_NAME,
  SLO_RESOURCES_VERSION,
} from '../../../common/constants';

export const HEALTH_MAPPINGS_TEMPLATE: ClusterPutComponentTemplateRequest = {
  name: HEALTH_COMPONENT_TEMPLATE_MAPPINGS_NAME,
  template: {
    mappings: {
      properties: {
        '@timestamp': {
          type: 'date',
          format: 'date_optional_time||epoch_millis',
        },
        id: {
          type: 'keyword',
          ignore_above: 256,
        },
        revision: {
          type: 'long',
        },
        version: {
          type: 'long',
        },
        instances: {
          type: 'long',
        },
        name: {
          type: 'text',
          fields: {
            keyword: {
              type: 'keyword',
            },
          },
        },
        description: {
          type: 'text',
        },
        tags: {
          type: 'keyword',
        },
        health: {
          properties: {
            status: {
              type: 'keyword',
            },
            summaryUpdatedAt: {
              type: 'date',
              format: 'date_optional_time||epoch_millis',
            },
            lastRollupIngestedAt: {
              type: 'date',
              format: 'date_optional_time||epoch_millis',
            },
            latency: {
              type: 'long',
            },
            outdatedVersion: { type: 'boolean' },
            summaryTransform: {
              properties: {
                id: { type: 'keyword', ignore_above: 256 },
                health: { type: 'keyword' },
                error: { type: 'text' },
              },
            },
            rollupTransform: {
              properties: {
                id: { type: 'keyword', ignore_above: 256 },
                health: { type: 'keyword' },
                error: { type: 'text' },
              },
            },
          },
        },
      },
    },
  },
  _meta: {
    description: 'Mappings for the SLO Health index',
    version: SLO_RESOURCES_VERSION,
    managed: true,
    managed_by: 'observability',
  },
};
