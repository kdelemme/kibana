/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import type { TestElasticsearchUtils, TestKibanaUtils } from '@kbn/core-test-helpers-kbn-server';
import type { ElasticsearchClient } from '@kbn/core/server';
import { ALERT_EVENTS_DATA_STREAM, type AlertEvent } from '../../../resources/alert_events';
import { RULE_SAVED_OBJECT_TYPE, type RuleSavedObjectAttributes } from '../../../saved_objects';
import { INTERNAL_ALERTING_V2_SUGGESTIONS_API_PATH } from '../../constants';
import { setupTestServers } from '../../../lib/dispatcher/integration_tests/setup_test_servers';
import {
  waitForDataStreamsReady,
  getSupertestWithAdminUser,
} from '../../../lib/dispatcher/integration_tests/helpers/wait';

const now = new Date().toISOString();

const RULE_ATTRIBUTES: RuleSavedObjectAttributes = {
  kind: 'alert',
  metadata: {
    name: 'production-cpu-high',
    description: 'CPU above threshold on production hosts',
    labels: ['production', 'critical'],
  },
  time_field: '@timestamp',
  schedule: { every: '1m' },
  evaluation: { query: { base: 'host.cpu > 90' } },
  enabled: true,
  createdBy: 'elastic',
  updatedBy: 'elastic',
  createdAt: now,
  updatedAt: now,
};

const RULE_ATTRIBUTES_2: RuleSavedObjectAttributes = {
  kind: 'alert',
  metadata: {
    name: 'staging-memory-high',
    description: 'Memory above threshold on staging hosts',
    labels: ['staging', 'critical'],
  },
  time_field: '@timestamp',
  schedule: { every: '5m' },
  evaluation: { query: { base: 'host.memory > 80' } },
  enabled: true,
  createdBy: 'elastic',
  updatedBy: 'elastic',
  createdAt: now,
  updatedAt: now,
};

describe('MatcherValueSuggestionsRoute integration tests', () => {
  let esServer: TestElasticsearchUtils;
  let kibanaServer: TestKibanaUtils;
  let esClient: ElasticsearchClient;

  beforeAll(async () => {
    const servers = await setupTestServers();
    esServer = servers.esServer;
    kibanaServer = servers.kibanaServer;
    esClient = kibanaServer.coreStart.elasticsearch.client.asInternalUser;

    await waitForDataStreamsReady(esClient, [ALERT_EVENTS_DATA_STREAM]);

    const soClient = kibanaServer.coreStart.savedObjects.getUnsafeInternalClient({
      includedHiddenTypes: [RULE_SAVED_OBJECT_TYPE],
    });

    await soClient.bulkCreate<RuleSavedObjectAttributes>([
      { type: RULE_SAVED_OBJECT_TYPE, id: 'rule-1', attributes: RULE_ATTRIBUTES },
      { type: RULE_SAVED_OBJECT_TYPE, id: 'rule-2', attributes: RULE_ATTRIBUTES_2 },
    ]);

    const alertEvents: AlertEvent[] = [
      {
        '@timestamp': new Date().toISOString(),
        type: 'alert',
        rule: { id: 'rule-1', version: 1 },
        group_hash: 'hash-abc',
        episode: { id: 'ep-100', status: 'active' },
        data: {},
        status: 'breached',
        source: 'internal',
      },
      {
        '@timestamp': new Date().toISOString(),
        type: 'alert',
        rule: { id: 'rule-1', version: 1 },
        group_hash: 'hash-def',
        episode: { id: 'ep-200', status: 'active' },
        data: {},
        status: 'breached',
        source: 'internal',
      },
    ];

    await esClient.bulk({
      refresh: 'wait_for',
      operations: alertEvents.flatMap((event) => [
        { create: { _index: ALERT_EVENTS_DATA_STREAM } },
        event,
      ]),
    });
  }, 120000);

  afterAll(async () => {
    if (kibanaServer) {
      await kibanaServer.stop();
    }
    if (esServer) {
      await esServer.stop();
    }
  });

  const postSuggestions = (field: string, query: string) =>
    getSupertestWithAdminUser(kibanaServer.root, 'post', INTERNAL_ALERTING_V2_SUGGESTIONS_API_PATH)
      .set('kbn-xsrf', 'true')
      .set('x-elastic-internal-origin', 'kibana')
      .send({ field, query });

  describe('episode_status', () => {
    it('returns matching statuses', async () => {
      const resp = await postSuggestions('episode_status', 'act');
      expect(resp.status).toBe(200);
      expect(resp.body).toEqual(['active']);
    });

    it('returns all statuses when query is empty', async () => {
      const resp = await postSuggestions('episode_status', '');
      expect(resp.status).toBe(200);
      expect(resp.body).toEqual(['inactive', 'pending', 'active', 'recovering']);
    });
  });

  describe('rule.name', () => {
    it('returns matching rule names', async () => {
      const resp = await postSuggestions('rule.name', 'production');
      expect(resp.status).toBe(200);
      expect(resp.body).toContain('production-cpu-high');
      expect(resp.body).not.toContain('staging-memory-high');
    });
  });

  describe('rule.description', () => {
    it('returns matching rule descriptions', async () => {
      const resp = await postSuggestions('rule.description', 'CPU');
      expect(resp.status).toBe(200);
      expect(resp.body).toContain('CPU above threshold on production hosts');
    });
  });

  describe('rule.labels', () => {
    it('returns deduplicated labels matching the prefix', async () => {
      const resp = await postSuggestions('rule.labels', 'crit');
      expect(resp.status).toBe(200);
      expect(resp.body).toEqual(['critical']);
    });
  });

  describe('rule.id', () => {
    it('returns matching rule IDs', async () => {
      const resp = await postSuggestions('rule.id', 'rule');
      expect(resp.status).toBe(200);
      expect(resp.body).toEqual(expect.arrayContaining(['rule-1', 'rule-2']));
    });
  });

  describe('episode_id', () => {
    it('returns matching episode IDs from alert events', async () => {
      const resp = await postSuggestions('episode_id', 'ep-');
      expect(resp.status).toBe(200);
      expect(resp.body).toEqual(expect.arrayContaining(['ep-100', 'ep-200']));
    });
  });

  describe('group_hash', () => {
    it('returns matching group hashes from alert events', async () => {
      const resp = await postSuggestions('group_hash', 'hash-');
      expect(resp.status).toBe(200);
      expect(resp.body).toEqual(expect.arrayContaining(['hash-abc', 'hash-def']));
    });
  });

  describe('unknown field', () => {
    it('returns empty array', async () => {
      const resp = await postSuggestions('unknown.field', '');
      expect(resp.status).toBe(200);
      expect(resp.body).toEqual([]);
    });
  });
});
