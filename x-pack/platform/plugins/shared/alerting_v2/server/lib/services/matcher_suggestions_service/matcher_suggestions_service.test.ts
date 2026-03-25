/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { savedObjectsClientMock } from '@kbn/core-saved-objects-api-server-mocks';
import { elasticsearchServiceMock } from '@kbn/core-elasticsearch-server-mocks';
import { RULE_SAVED_OBJECT_TYPE } from '../../../saved_objects';
import { MatcherSuggestionsService } from './matcher_suggestions_service';

const createService = () => {
  const ruleSoClient = savedObjectsClientMock.create();
  const esClient = elasticsearchServiceMock.createElasticsearchClient();
  const service = new MatcherSuggestionsService(ruleSoClient, esClient);

  return { service, ruleSoClient, esClient };
};

describe('MatcherSuggestionsService', () => {
  describe('episode_status', () => {
    it('returns all statuses when query is empty', async () => {
      const { service } = createService();
      const result = await service.getSuggestions('episode_status', '');
      expect(result).toEqual(['inactive', 'pending', 'active', 'recovering']);
    });

    it('filters statuses by prefix', async () => {
      const { service } = createService();
      const result = await service.getSuggestions('episode_status', 'act');
      expect(result).toEqual(['active']);
    });
  });

  describe('rule.name', () => {
    it('returns rule names from saved objects', async () => {
      const { service, ruleSoClient } = createService();

      ruleSoClient.find.mockResolvedValue({
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

      const result = await service.getSuggestions('rule.name', 'prod');

      expect(ruleSoClient.find).toHaveBeenCalledWith(
        expect.objectContaining({
          type: RULE_SAVED_OBJECT_TYPE,
          search: 'prod*',
          searchFields: ['metadata.name'],
        })
      );
      expect(result).toEqual(['production-cpu', 'production-memory']);
    });
  });

  describe('rule.description', () => {
    it('returns rule descriptions from saved objects', async () => {
      const { service, ruleSoClient } = createService();

      ruleSoClient.find.mockResolvedValue({
        saved_objects: [
          {
            id: 'rule-1',
            type: RULE_SAVED_OBJECT_TYPE,
            attributes: { metadata: { name: 'r1', description: 'CPU above threshold' } },
            references: [],
            score: 1,
          },
        ],
        total: 1,
        per_page: 10,
        page: 1,
      });

      const result = await service.getSuggestions('rule.description', 'CPU');

      expect(ruleSoClient.find).toHaveBeenCalledWith(
        expect.objectContaining({
          type: RULE_SAVED_OBJECT_TYPE,
          search: 'CPU*',
          searchFields: ['metadata.description'],
        })
      );
      expect(result).toEqual(['CPU above threshold']);
    });
  });

  describe('rule.labels', () => {
    it('returns deduplicated labels filtered by prefix', async () => {
      const { service, ruleSoClient } = createService();

      ruleSoClient.find.mockResolvedValue({
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

      const result = await service.getSuggestions('rule.labels', 'prod');
      expect(result).toEqual(['production']);
    });
  });

  describe('rule.id', () => {
    it('returns rule IDs', async () => {
      const { service, ruleSoClient } = createService();

      ruleSoClient.find.mockResolvedValue({
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

      const result = await service.getSuggestions('rule.id', '');
      expect(result).toEqual(['abc-123']);
    });

    it('filters rule IDs by prefix', async () => {
      const { service, ruleSoClient } = createService();

      ruleSoClient.find.mockResolvedValue({
        saved_objects: [
          {
            id: 'abc-123',
            type: RULE_SAVED_OBJECT_TYPE,
            attributes: { metadata: { name: 'r1' } },
            references: [],
            score: 1,
          },
          {
            id: 'def-456',
            type: RULE_SAVED_OBJECT_TYPE,
            attributes: { metadata: { name: 'r2' } },
            references: [],
            score: 1,
          },
        ],
        total: 2,
        per_page: 100,
        page: 1,
      });

      const result = await service.getSuggestions('rule.id', 'abc');
      expect(result).toEqual(['abc-123']);
    });
  });

  describe('episode_id', () => {
    it('returns values from .alerting-events terms aggregation', async () => {
      const { service, esClient } = createService();

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

      const result = await service.getSuggestions('episode_id', 'ep-');

      expect(esClient.search).toHaveBeenCalledWith(
        expect.objectContaining({
          index: '.rule-events',
          query: {
            bool: {
              filter: [{ term: { type: 'alert' } }, { range: { '@timestamp': { gte: 'now-1h' } } }],
            },
          },
        })
      );
      expect(result).toEqual(['ep-123', 'ep-456']);
    });

    it('returns empty array when index does not exist', async () => {
      const { service, esClient } = createService();

      const error = new Error('index_not_found_exception');
      Object.assign(error, {
        meta: { body: { error: { type: 'index_not_found_exception' } } },
      });
      esClient.search.mockRejectedValue(error);

      const result = await service.getSuggestions('episode_id', '');
      expect(result).toEqual([]);
    });
  });

  describe('group_hash', () => {
    it('queries the correct ES field', async () => {
      const { service, esClient } = createService();

      esClient.search.mockResolvedValue({
        took: 1,
        timed_out: false,
        _shards: { total: 1, successful: 1, skipped: 0, failed: 0 },
        hits: { total: { value: 0, relation: 'eq' }, hits: [] },
        aggregations: { suggestions: { buckets: [] } },
      });

      await service.getSuggestions('group_hash', 'abc');

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
      const { service } = createService();
      const result = await service.getSuggestions('unknown.field', '');
      expect(result).toEqual([]);
    });
  });

  describe('data.* fields', () => {
    it('delegates data.severity to ES terms aggregation', async () => {
      const { service, esClient } = createService();

      esClient.search.mockResolvedValue({
        took: 1,
        timed_out: false,
        _shards: { total: 1, successful: 1, skipped: 0, failed: 0 },
        hits: { total: { value: 0, relation: 'eq' }, hits: [] },
        aggregations: {
          suggestions: {
            buckets: [
              { key: 'critical', doc_count: 10 },
              { key: 'warning', doc_count: 5 },
            ],
          },
        },
      });

      const result = await service.getSuggestions('data.severity', '');

      expect(esClient.search).toHaveBeenCalledWith(
        expect.objectContaining({
          aggs: expect.objectContaining({
            suggestions: expect.objectContaining({
              terms: expect.objectContaining({
                field: 'data.severity',
              }),
            }),
          }),
        })
      );
      expect(result).toEqual(['critical', 'warning']);
    });

    it('delegates nested data fields to ES terms aggregation', async () => {
      const { service, esClient } = createService();

      esClient.search.mockResolvedValue({
        took: 1,
        timed_out: false,
        _shards: { total: 1, successful: 1, skipped: 0, failed: 0 },
        hits: { total: { value: 0, relation: 'eq' }, hits: [] },
        aggregations: {
          suggestions: {
            buckets: [{ key: 'web-01', doc_count: 3 }],
          },
        },
      });

      const result = await service.getSuggestions('data.host.name', 'web');
      expect(result).toEqual(['web-01']);
    });
  });

  describe('getDataFieldNames', () => {
    it('extracts data field names from sampled documents', async () => {
      const { service, esClient } = createService();

      esClient.search.mockResolvedValue({
        took: 1,
        timed_out: false,
        _shards: { total: 1, successful: 1, skipped: 0, failed: 0 },
        hits: {
          total: { value: 2, relation: 'eq' },
          hits: [
            {
              _index: '.ds-.rule-events-1',
              _id: '1',
              _source: { data: { severity: 'critical', env: 'production' } },
            },
            {
              _index: '.ds-.rule-events-1',
              _id: '2',
              _source: { data: { severity: 'warning', region: 'us-east' } },
            },
          ],
        },
      });

      const result = await service.getDataFieldNames();
      expect(result).toEqual(['data.env', 'data.region', 'data.severity']);
    });

    it('extracts nested data field names with dot notation', async () => {
      const { service, esClient } = createService();

      esClient.search.mockResolvedValue({
        took: 1,
        timed_out: false,
        _shards: { total: 1, successful: 1, skipped: 0, failed: 0 },
        hits: {
          total: { value: 1, relation: 'eq' },
          hits: [
            {
              _index: '.ds-.rule-events-1',
              _id: '1',
              _source: { data: { host: { name: 'web-01', ip: '10.0.0.1' }, severity: 'critical' } },
            },
          ],
        },
      });

      const result = await service.getDataFieldNames();
      expect(result).toEqual(['data.host.ip', 'data.host.name', 'data.severity']);
    });

    it('returns empty array when no documents exist', async () => {
      const { service, esClient } = createService();

      esClient.search.mockResolvedValue({
        took: 1,
        timed_out: false,
        _shards: { total: 1, successful: 1, skipped: 0, failed: 0 },
        hits: { total: { value: 0, relation: 'eq' }, hits: [] },
      });

      const result = await service.getDataFieldNames();
      expect(result).toEqual([]);
    });

    it('returns empty array when index does not exist', async () => {
      const { service, esClient } = createService();

      const error = new Error('index_not_found_exception');
      Object.assign(error, {
        meta: { body: { error: { type: 'index_not_found_exception' } } },
      });
      esClient.search.mockRejectedValue(error);

      const result = await service.getDataFieldNames();
      expect(result).toEqual([]);
    });

    it('skips documents with no data field', async () => {
      const { service, esClient } = createService();

      esClient.search.mockResolvedValue({
        took: 1,
        timed_out: false,
        _shards: { total: 1, successful: 1, skipped: 0, failed: 0 },
        hits: {
          total: { value: 2, relation: 'eq' },
          hits: [
            { _index: '.ds-.rule-events-1', _id: '1', _source: { data: { severity: 'critical' } } },
            { _index: '.ds-.rule-events-1', _id: '2', _source: {} },
          ],
        },
      });

      const result = await service.getDataFieldNames();
      expect(result).toEqual(['data.severity']);
    });
  });

  describe('timestamp fields', () => {
    it('returns empty array for last_event_timestamp', async () => {
      const { service } = createService();
      const result = await service.getSuggestions('last_event_timestamp', '');
      expect(result).toEqual([]);
    });

    it('returns empty array for rule.createdAt', async () => {
      const { service } = createService();
      const result = await service.getSuggestions('rule.createdAt', '');
      expect(result).toEqual([]);
    });
  });
});
