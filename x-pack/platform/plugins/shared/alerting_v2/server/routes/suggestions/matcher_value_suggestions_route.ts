/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import Boom from '@hapi/boom';
import { schema } from '@kbn/config-schema';
import type {
  ElasticsearchClient,
  KibanaRequest,
  KibanaResponseFactory,
  SavedObjectsClientContract,
} from '@kbn/core/server';
import type { RouteSecurity } from '@kbn/core-http-server';
import type { TypeOf } from '@kbn/config-schema';
import { inject, injectable } from 'inversify';
import { Request, Response } from '@kbn/core-di-server';
import { ALERTING_V2_API_PRIVILEGES } from '../../lib/security/privileges';
import { INTERNAL_ALERTING_V2_SUGGESTIONS_API_PATH, MatcherField } from '../constants';
import { EsServiceScopedToken } from '../../lib/services/es_service/tokens';
import { RuleSavedObjectsClientToken } from '../../lib/services/rules_saved_object_service/tokens';
import { ALERT_EVENTS_DATA_STREAM, alertEpisodeStatus } from '../../resources/alert_events';
import { RULE_SAVED_OBJECT_TYPE, type RuleSavedObjectAttributes } from '../../saved_objects';

const MAX_SUGGESTIONS = 10;

const suggestionsBodySchema = schema.object({
  field: schema.string(),
  query: schema.string(),
  filters: schema.maybe(schema.any()),
  fieldMeta: schema.maybe(schema.any()),
});

type SuggestionsBody = TypeOf<typeof suggestionsBodySchema>;

const EPISODE_STATUS_VALUES = Object.values(alertEpisodeStatus);

const MATCHER_FIELD_TO_ES_FIELD: Record<string, string> = {
  [MatcherField.EpisodeId]: 'episode.id',
  [MatcherField.GroupHash]: 'group_hash',
};

const getEscapedQuery = (q: string = '') =>
  q.replace(/[.?+*|{}[\]()"\\#@&<>~]/g, (match) => `\\${match}`);

@injectable()
export class MatcherValueSuggestionsRoute {
  static method = 'post' as const;
  static path = INTERNAL_ALERTING_V2_SUGGESTIONS_API_PATH;
  static security: RouteSecurity = {
    authz: {
      requiredPrivileges: [
        ALERTING_V2_API_PRIVILEGES.notificationPolicies.read,
        ALERTING_V2_API_PRIVILEGES.rules.read,
      ],
    },
  };
  static options = { access: 'internal' } as const;
  static validate = {
    request: {
      body: suggestionsBodySchema,
    },
  } as const;

  constructor(
    @inject(Request)
    private readonly request: KibanaRequest<unknown, unknown, SuggestionsBody>,
    @inject(Response) private readonly response: KibanaResponseFactory,
    @inject(RuleSavedObjectsClientToken)
    private readonly ruleSoClient: SavedObjectsClientContract,
    @inject(EsServiceScopedToken)
    private readonly esClient: ElasticsearchClient
  ) {}

  async handle() {
    const { field, query } = this.request.body;

    try {
      const values = await this.getSuggestionsForField(field, query);
      return this.response.ok({ body: values });
    } catch (e) {
      const boom = Boom.isBoom(e) ? e : Boom.boomify(e);
      return this.response.customError({
        statusCode: boom.output.statusCode,
        body: boom.output.payload,
      });
    }
  }

  private async getSuggestionsForField(field: string, query: string): Promise<string[]> {
    switch (field) {
      case MatcherField.EpisodeStatus:
        return this.getStaticSuggestions(EPISODE_STATUS_VALUES, query);

      case MatcherField.RuleName:
        return this.getRuleSoFieldSuggestions(query, 'metadata.name', (a) => a.metadata.name);

      case MatcherField.RuleDescription:
        return this.getRuleSoFieldSuggestions(
          query,
          'metadata.description',
          (a) => a.metadata.description
        );

      case MatcherField.RuleLabels:
        return this.getRuleLabelsSuggestions(query);

      case MatcherField.RuleId:
        return this.getRuleIdSuggestions(query);

      case MatcherField.EpisodeId:
      case MatcherField.GroupHash:
        return this.getAlertEventFieldSuggestions(MATCHER_FIELD_TO_ES_FIELD[field] ?? field, query);

      default:
        return [];
    }
  }

  private getStaticSuggestions(values: string[], query: string): string[] {
    const lowerQuery = query.toLowerCase();
    return values
      .filter((v) => !lowerQuery || v.toLowerCase().startsWith(lowerQuery))
      .slice(0, MAX_SUGGESTIONS);
  }

  private async getRuleSoFieldSuggestions(
    query: string,
    searchField: string,
    accessor: (attrs: RuleSavedObjectAttributes) => string | undefined
  ): Promise<string[]> {
    const result = await this.ruleSoClient.find<RuleSavedObjectAttributes>({
      type: RULE_SAVED_OBJECT_TYPE,
      page: 1,
      perPage: MAX_SUGGESTIONS,
      ...(query ? { search: `${query}*`, searchFields: [searchField] } : {}),
      sortField: 'updatedAt',
      sortOrder: 'desc',
    });

    return result.saved_objects
      .map((so) => accessor(so.attributes))
      .filter((v): v is string => typeof v === 'string' && v.length > 0);
  }

  private async getRuleLabelsSuggestions(query: string): Promise<string[]> {
    const result = await this.ruleSoClient.find<RuleSavedObjectAttributes>({
      type: RULE_SAVED_OBJECT_TYPE,
      page: 1,
      perPage: 100,
      fields: ['metadata.labels'],
      sortField: 'updatedAt',
      sortOrder: 'desc',
    });

    const allLabels = new Set<string>();
    for (const so of result.saved_objects) {
      const labels = so.attributes.metadata.labels;
      if (Array.isArray(labels)) {
        for (const label of labels) {
          allLabels.add(label);
        }
      }
    }

    const lowerQuery = query.toLowerCase();
    return Array.from(allLabels)
      .filter((label) => !lowerQuery || label.toLowerCase().startsWith(lowerQuery))
      .sort()
      .slice(0, MAX_SUGGESTIONS);
  }

  private async getRuleIdSuggestions(query: string): Promise<string[]> {
    const result = await this.ruleSoClient.find<RuleSavedObjectAttributes>({
      type: RULE_SAVED_OBJECT_TYPE,
      page: 1,
      perPage: MAX_SUGGESTIONS,
      ...(query ? { search: `${query}*` } : {}),
      sortField: 'updatedAt',
      sortOrder: 'desc',
    });

    return result.saved_objects.map((so) => so.id);
  }

  private async getAlertEventFieldSuggestions(
    esFieldName: string,
    query: string
  ): Promise<string[]> {
    try {
      const result = await this.esClient.search({
        index: ALERT_EVENTS_DATA_STREAM,
        size: 0,
        timeout: '10s',
        terminate_after: 100000,
        query: {
          bool: {
            filter: [{ term: { type: 'alert' } }, { range: { '@timestamp': { gte: 'now-1h' } } }],
          },
        },
        aggs: {
          suggestions: {
            terms: {
              field: esFieldName,
              include: `${getEscapedQuery(query)}.*`,
              execution_hint: 'map' as const,
              shard_size: MAX_SUGGESTIONS,
            },
          },
        },
      });

      const aggs = result.aggregations as
        | { suggestions?: { buckets?: Array<{ key: string }> } }
        | undefined;
      return (aggs?.suggestions?.buckets ?? []).map((bucket) => bucket.key);
    } catch (e) {
      if (
        e?.meta?.body?.error?.type === 'index_not_found_exception' ||
        e?.body?.error?.type === 'index_not_found_exception'
      ) {
        return [];
      }
      throw e;
    }
  }
}
