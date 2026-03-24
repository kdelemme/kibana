/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import expect from '@kbn/expect';
import type { DeploymentAgnosticFtrProviderContext } from '../../../ftr_provider_context';
import type { RoleCredentials } from '../../../services';
import { createAlertEvent, indexAlertEvents } from '../fixtures';

const SUGGESTIONS_API_PATH = '/internal/notification_policies/suggestions/values';
const RULE_API_PATH = '/internal/alerting/v2/rule';
const RULE_SO_TYPE = 'alerting_rule';

export default function ({ getService }: DeploymentAgnosticFtrProviderContext) {
  const samlAuth = getService('samlAuth');
  const supertestWithoutAuth = getService('supertestWithoutAuth');
  const kibanaServer = getService('kibanaServer');
  const es = getService('es');

  describe('Matcher Value Suggestions API', function () {
    this.tags(['skipCloud']);
    let roleAuthc: RoleCredentials;

    before(async () => {
      await kibanaServer.savedObjects.clean({ types: [RULE_SO_TYPE] });
      roleAuthc = await samlAuth.createM2mApiKeyWithRoleScope('admin');

      // Create rules for rule.name, rule.description, rule.labels, rule.id suggestions
      await supertestWithoutAuth
        .post(RULE_API_PATH)
        .set(roleAuthc.apiKeyHeader)
        .set(samlAuth.getInternalRequestHeader())
        .send({
          kind: 'alert',
          metadata: {
            name: 'production-cpu-high',
            description: 'CPU above threshold on production hosts',
            labels: ['production', 'critical'],
          },
          time_field: '@timestamp',
          schedule: { every: '1m' },
          evaluation: { query: { base: 'FROM metrics-* | LIMIT 10' } },
        });

      await supertestWithoutAuth
        .post(RULE_API_PATH)
        .set(roleAuthc.apiKeyHeader)
        .set(samlAuth.getInternalRequestHeader())
        .send({
          kind: 'alert',
          metadata: {
            name: 'staging-memory-high',
            description: 'Memory above threshold on staging hosts',
            labels: ['staging', 'critical'],
          },
          time_field: '@timestamp',
          schedule: { every: '5m' },
          evaluation: { query: { base: 'FROM metrics-* | LIMIT 10' } },
        });

      // Index alert events for episode_id and group_hash suggestions
      await indexAlertEvents(es, [
        createAlertEvent({
          group_hash: 'hash-abc',
          episode: { id: 'ep-100', status: 'active' },
        }),
        createAlertEvent({
          group_hash: 'hash-def',
          episode: { id: 'ep-200', status: 'active' },
        }),
      ]);
    });

    after(async () => {
      await kibanaServer.savedObjects.clean({ types: [RULE_SO_TYPE] });
      await es.deleteByQuery({
        index: '.alerting-events',
        query: { match_all: {} },
        refresh: true,
        ignore_unavailable: true,
      });
      await samlAuth.invalidateM2mApiKeyWithRoleScope(roleAuthc);
    });

    const postSuggestions = (field: string, query: string) =>
      supertestWithoutAuth
        .post(SUGGESTIONS_API_PATH)
        .set(roleAuthc.apiKeyHeader)
        .set(samlAuth.getInternalRequestHeader())
        .send({ field, query });

    describe('episode_status', () => {
      it('should return all statuses when query is empty', async () => {
        const resp = await postSuggestions('episode_status', '');
        expect(resp.status).to.be(200);
        expect(resp.body).to.eql(['inactive', 'pending', 'active', 'recovering']);
      });

      it('should filter statuses by prefix', async () => {
        const resp = await postSuggestions('episode_status', 'act');
        expect(resp.status).to.be(200);
        expect(resp.body).to.eql(['active']);
      });
    });

    describe('rule.name', () => {
      it('should return matching rule names', async () => {
        const resp = await postSuggestions('rule.name', 'production');
        expect(resp.status).to.be(200);
        expect(resp.body).to.contain('production-cpu-high');
        expect(resp.body).not.to.contain('staging-memory-high');
      });
    });

    describe('rule.description', () => {
      it('should return matching rule descriptions', async () => {
        const resp = await postSuggestions('rule.description', 'CPU');
        expect(resp.status).to.be(200);
        expect(resp.body).to.contain('CPU above threshold on production hosts');
      });
    });

    describe('rule.labels', () => {
      it('should return deduplicated labels matching the prefix', async () => {
        const resp = await postSuggestions('rule.labels', 'crit');
        expect(resp.status).to.be(200);
        expect(resp.body).to.eql(['critical']);
      });
    });

    describe('rule.id', () => {
      it('should return rule IDs', async () => {
        const resp = await postSuggestions('rule.id', '');
        expect(resp.status).to.be(200);
        expect(resp.body.length).to.be(2);
      });
    });

    describe('episode_id', () => {
      it('should return matching episode IDs from alert events', async () => {
        const resp = await postSuggestions('episode_id', 'ep-');
        expect(resp.status).to.be(200);
        expect(resp.body).to.contain('ep-100');
        expect(resp.body).to.contain('ep-200');
      });
    });

    describe('group_hash', () => {
      it('should return matching group hashes from alert events', async () => {
        const resp = await postSuggestions('group_hash', 'hash-');
        expect(resp.status).to.be(200);
        expect(resp.body).to.contain('hash-abc');
        expect(resp.body).to.contain('hash-def');
      });
    });

    describe('unknown field', () => {
      it('should return empty array', async () => {
        const resp = await postSuggestions('unknown.field', '');
        expect(resp.status).to.be(200);
        expect(resp.body).to.eql([]);
      });
    });
  });
}
