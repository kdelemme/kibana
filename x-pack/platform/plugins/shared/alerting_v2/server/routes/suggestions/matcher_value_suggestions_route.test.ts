/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import type { KibanaRequest, KibanaResponseFactory } from '@kbn/core-http-server';
import { httpServerMock } from '@kbn/core-http-server-mocks';
import { savedObjectsClientMock } from '@kbn/core-saved-objects-api-server-mocks';
import { elasticsearchServiceMock } from '@kbn/core-elasticsearch-server-mocks';
import { RULE_SAVED_OBJECT_TYPE } from '../../saved_objects';
import { MatcherValueSuggestionsRoute } from './matcher_value_suggestions_route';

const createRoute = ({ field, query }: { field: string; query: string }) => {
  const request = httpServerMock.createKibanaRequest({
    body: { field, query },
  }) as KibanaRequest<unknown, unknown, { field: string; query: string }>;
  const response = httpServerMock.createResponseFactory();
  const savedObjectsClient = savedObjectsClientMock.create();
  const esClient = elasticsearchServiceMock.createElasticsearchClient();

  const route = new MatcherValueSuggestionsRoute(
    request,
    response as unknown as KibanaResponseFactory,
    savedObjectsClient,
    esClient
  );

  return { route, response, savedObjectsClient, esClient };
};

describe('MatcherValueSuggestionsRoute', () => {
  describe('episode_status', () => {
    it('returns all statuses when query is empty', async () => {
      const { route, response } = createRoute({ field: 'episode_status', query: '' });
      await route.handle();
      expect(response.ok).toHaveBeenCalledWith({
        body: ['inactive', 'pending', 'active', 'recovering'],
      });
    });

    it('filters statuses by prefix', async () => {
      const { route, response } = createRoute({ field: 'episode_status', query: 'act' });
      await route.handle();
      expect(response.ok).toHaveBeenCalledWith({
        body: ['active'],
      });
    });
  });

  describe('rule.name', () => {
    it('returns rule names from saved objects', async () => {
      const { route, response, savedObjectsClient } = createRoute({
        field: 'rule.name',
        query: 'prod',
      });

      savedObjectsClient.find.mockResolvedValue({
        saved_objects: [
          {
            id: 'rule-1',
            type: RULE_SAVED_OBJECT_TYPE,
            attributes: { metadata: { name: 'production-cpu' } },
            references: [],
            score: 1,
          },
          {
            id: 'rule-2',
            type: RULE_SAVED_OBJECT_TYPE,
            attributes: { metadata: { name: 'production-memory' } },
            references: [],
            score: 1,
          },
        ],
        total: 2,
        per_page: 10,
        page: 1,
      });

      await route.handle();

      expect(savedObjectsClient.find).toHaveBeenCalledWith(
        expect.objectContaining({
          type: RULE_SAVED_OBJECT_TYPE,
          search: 'prod*',
          searchFields: ['metadata.name'],
        })
      );
      expect(response.ok).toHaveBeenCalledWith({
        body: ['production-cpu', 'production-memory'],
      });
    });
  });

  describe('rule.labels', () => {
    it('returns deduplicated labels filtered by prefix', async () => {
      const { route, response, savedObjectsClient } = createRoute({
        field: 'rule.labels',
        query: 'prod',
      });

      savedObjectsClient.find.mockResolvedValue({
        saved_objects: [
          {
            id: 'rule-1',
            type: RULE_SAVED_OBJECT_TYPE,
            attributes: { metadata: { name: 'r1', labels: ['production', 'critical'] } },
            references: [],
            score: 1,
          },
          {
            id: 'rule-2',
            type: RULE_SAVED_OBJECT_TYPE,
            attributes: { metadata: { name: 'r2', labels: ['production', 'staging'] } },
            references: [],
            score: 1,
          },
        ],
        total: 2,
        per_page: 100,
        page: 1,
      });

      await route.handle();

      expect(response.ok).toHaveBeenCalledWith({
        body: ['production'],
      });
    });
  });

  describe('rule.id', () => {
    it('returns rule IDs', async () => {
      const { route, response, savedObjectsClient } = createRoute({
        field: 'rule.id',
        query: '',
      });

      savedObjectsClient.find.mockResolvedValue({
        saved_objects: [
          {
            id: 'abc-123',
            type: RULE_SAVED_OBJECT_TYPE,
            attributes: { metadata: { name: 'r1' } },
            references: [],
            score: 1,
          },
        ],
        total: 1,
        per_page: 10,
        page: 1,
      });

      await route.handle();

      expect(response.ok).toHaveBeenCalledWith({
        body: ['abc-123'],
      });
    });
  });

  describe('episode_id', () => {
    it('returns values from .alerting-events terms aggregation', async () => {
      const { route, response, esClient } = createRoute({
        field: 'episode_id',
        query: 'ep-',
      });

      esClient.search.mockResolvedValue({
        took: 1,
        timed_out: false,
        _shards: { total: 1, successful: 1, skipped: 0, failed: 0 },
        hits: { total: { value: 0, relation: 'eq' }, hits: [] },
        aggregations: {
          suggestions: {
            buckets: [
              { key: 'ep-123', doc_count: 5 },
              { key: 'ep-456', doc_count: 3 },
            ],
          },
        },
      });

      await route.handle();

      expect(esClient.search).toHaveBeenCalledWith(
        expect.objectContaining({
          index: '.alerting-events',
          query: {
            bool: {
              filter: [{ term: { type: 'alert' } }, { range: { '@timestamp': { gte: 'now-1h' } } }],
            },
          },
        })
      );
      expect(response.ok).toHaveBeenCalledWith({
        body: ['ep-123', 'ep-456'],
      });
    });

    it('returns empty array when index does not exist', async () => {
      const { route, response, esClient } = createRoute({
        field: 'episode_id',
        query: '',
      });

      const error = new Error('index_not_found_exception');
      Object.assign(error, {
        meta: { body: { error: { type: 'index_not_found_exception' } } },
      });
      esClient.search.mockRejectedValue(error);

      await route.handle();

      expect(response.ok).toHaveBeenCalledWith({
        body: [],
      });
    });
  });

  describe('group_hash', () => {
    it('queries the correct ES field', async () => {
      const { route, esClient } = createRoute({
        field: 'group_hash',
        query: 'abc',
      });

      esClient.search.mockResolvedValue({
        took: 1,
        timed_out: false,
        _shards: { total: 1, successful: 1, skipped: 0, failed: 0 },
        hits: { total: { value: 0, relation: 'eq' }, hits: [] },
        aggregations: { suggestions: { buckets: [] } },
      });

      await route.handle();

      expect(esClient.search).toHaveBeenCalledWith(
        expect.objectContaining({
          aggs: expect.objectContaining({
            suggestions: expect.objectContaining({
              terms: expect.objectContaining({
                field: 'group_hash',
              }),
            }),
          }),
        })
      );
    });
  });

  describe('unknown field', () => {
    it('returns empty array', async () => {
      const { route, response } = createRoute({ field: 'unknown.field', query: '' });
      await route.handle();
      expect(response.ok).toHaveBeenCalledWith({ body: [] });
    });
  });

  describe('timestamp fields', () => {
    it('returns empty array for last_event_timestamp', async () => {
      const { route, response } = createRoute({ field: 'last_event_timestamp', query: '' });
      await route.handle();
      expect(response.ok).toHaveBeenCalledWith({ body: [] });
    });

    it('returns empty array for rule.createdAt', async () => {
      const { route, response } = createRoute({ field: 'rule.createdAt', query: '' });
      await route.handle();
      expect(response.ok).toHaveBeenCalledWith({ body: [] });
    });
  });
});
