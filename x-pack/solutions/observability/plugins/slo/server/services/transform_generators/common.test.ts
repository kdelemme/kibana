/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { ALL_VALUE } from '@kbn/slo-schema';
import { fiveMinute, twoMinute } from '../fixtures/duration';
import { createAPMTransactionDurationIndicator, createSLO } from '../fixtures/slo';
import { thirtyDaysRolling } from '../fixtures/time_window';
import {
  buildApmExtraGroupByFields,
  buildApmSourceFilters,
  getTimesliceTargetComparator,
  INVALID_EQUATION_REGEX,
  parseIndex,
  getFilterRange,
  getElasticsearchQueryOrThrow,
} from './common';
import { createStubDataView } from '@kbn/data-views-plugin/common/data_views/data_view.stub';

describe('common', () => {
  describe('parseIndex', () => {
    it.each([
      ['foo-*', 'foo-*'],
      ['foo-*,bar-*', ['foo-*', 'bar-*']],
      ['remote:foo-*', 'remote:foo-*'],
      ['remote:foo*,bar-*', ['remote:foo*', 'bar-*']],
      ['remote:foo*,remote:bar-*', ['remote:foo*', 'remote:bar-*']],
      ['remote:foo*,bar-*,remote:baz-*', ['remote:foo*', 'bar-*', 'remote:baz-*']],
    ])("parses the index '%s' correctly", (index, expected) => {
      expect(parseIndex(index)).toEqual(expected);
    });
  });

  describe('timeslice target comparator', () => {
    it('returns GT when timeslice target is 0', () => {
      expect(getTimesliceTargetComparator(0)).toBe('>');
    });

    it('returns GTE when timeslice tyarnarget is not 0', () => {
      expect(getTimesliceTargetComparator(0.000000001)).toBe('>=');
    });
  });

  describe('getFilterRange', () => {
    it('starts at now (accounting for delay) when preventInitialBackfill is true', () => {
      expect(
        getFilterRange(
          createSLO({
            settings: {
              frequency: twoMinute(),
              syncDelay: fiveMinute(),
              preventInitialBackfill: true,
            },
          }),
          '@timestamp',
          false
        )
      ).toEqual({
        range: {
          '@timestamp': {
            gte: 'now-480s/m',
          },
        },
      });
    });

    it('starts at now minus the time window when preventInitialBackfill is false', () => {
      expect(
        getFilterRange(
          createSLO({
            timeWindow: thirtyDaysRolling(),
            settings: {
              frequency: twoMinute(),
              syncDelay: fiveMinute(),
              preventInitialBackfill: false,
            },
          }),
          '@timestamp',
          false
        )
      ).toEqual({
        range: {
          '@timestamp': {
            gte: 'now-30d/d',
          },
        },
      });
    });

    it('starts at now minus 7 days when preventInitialBackfill is false and serverless is true', () => {
      expect(
        getFilterRange(
          createSLO({
            timeWindow: thirtyDaysRolling(),
            settings: {
              frequency: twoMinute(),
              syncDelay: fiveMinute(),
              preventInitialBackfill: false,
            },
          }),
          '@timestamp',
          true
        )
      ).toEqual({
        range: {
          '@timestamp': {
            gte: 'now-7d',
          },
        },
      });
    });
  });

  describe('getElasticsearchQueryOrThrow', () => {
    it('throws an error if the query is not a valid Elasticsearch query', () => {
      expect(() => {
        getElasticsearchQueryOrThrow('data:');
      }).toThrowErrorMatchingInlineSnapshot(`"Invalid KQL: data:"`);
    });

    it('returns the query if it is a valid Elasticsearch query', () => {
      expect(getElasticsearchQueryOrThrow('monitor.status: down')).toEqual({
        bool: {
          filter: [
            {
              bool: {
                minimum_should_match: 1,
                should: [
                  {
                    match: {
                      'monitor.status': 'down',
                    },
                  },
                ],
              },
            },
          ],
          must: [],
          must_not: [],
          should: [],
        },
      });
    });

    it('works with wildcard queries', () => {
      const mockDataView = createStubDataView({
        spec: {
          id: 'apm-*',
          title: 'apm-*',
          timeFieldName: '@timestamp',
          fields: {
            'monitor.status': {
              name: 'monitor.status',
              type: 'string',
              esTypes: ['keyword'],
              searchable: true,
              aggregatable: true,
              readFromDocValues: true,
            },
          },
        },
      });
      expect(getElasticsearchQueryOrThrow('monitor.status: *own', mockDataView)).toEqual({
        bool: {
          filter: [
            {
              bool: {
                minimum_should_match: 1,
                should: [
                  {
                    wildcard: {
                      'monitor.status': {
                        value: '*own',
                      },
                    },
                  },
                ],
              },
            },
          ],
          must: [],
          must_not: [],
          should: [],
        },
      });
    });

    it('works with wildcard queries and filters', () => {
      const mockDataView = createStubDataView({
        spec: {
          id: 'apm-*',
          title: 'apm-*',
          timeFieldName: '@timestamp',
          fields: {
            'monitor.status': {
              name: 'monitor.status',
              type: 'string',
              esTypes: ['keyword'],
              searchable: true,
              aggregatable: true,
              readFromDocValues: true,
            },
          },
        },
      });
      expect(
        getElasticsearchQueryOrThrow(
          { kqlQuery: 'monitor.status: *own', filters: [] },
          mockDataView
        )
      ).toEqual({
        bool: {
          filter: [
            {
              bool: {
                minimum_should_match: 1,
                should: [
                  {
                    wildcard: {
                      'monitor.status': {
                        value: '*own',
                      },
                    },
                  },
                ],
              },
            },
          ],
          must: [],
          must_not: [],
          should: [],
        },
      });
    });

    it('works with empty queries and filters', () => {
      expect(getElasticsearchQueryOrThrow('')).toEqual({
        match_all: {},
      });
      expect(getElasticsearchQueryOrThrow({} as any)).toEqual({
        match_all: {},
      });
    });
  });

  describe('INVALID_EQUATION_REGEX', () => {
    it('allows valid equations with uppercase letters, operators, digits, and spaces', () => {
      expect('A + B'.match(INVALID_EQUATION_REGEX)).toBeNull();
      expect('(A - B) / C * 100'.match(INVALID_EQUATION_REGEX)).toBeNull();
      expect('A > 0 ? A : 0'.match(INVALID_EQUATION_REGEX)).toBeNull();
    });

    it('rejects equations with lowercase letters', () => {
      expect('a + b'.match(INVALID_EQUATION_REGEX)).not.toBeNull();
      expect('Math.floor(A)'.match(INVALID_EQUATION_REGEX)).not.toBeNull();
    });
  });

  describe('buildApmSourceFilters', () => {
    it('returns match filters for each non-ALL_VALUE param', () => {
      const indicator = createAPMTransactionDurationIndicator({
        service: 'my-service',
        environment: 'production',
        transactionName: 'GET /api',
        transactionType: 'request',
      });
      const filters = buildApmSourceFilters({ type: indicator.type, params: indicator.params });
      expect(filters).toEqual([
        { match: { 'service.name': 'my-service' } },
        { match: { 'service.environment': 'production' } },
        { match: { 'transaction.name': 'GET /api' } },
        { match: { 'transaction.type': 'request' } },
      ]);
    });

    it('returns empty array when all params are ALL_VALUE', () => {
      const indicator = createAPMTransactionDurationIndicator({
        service: ALL_VALUE,
        environment: ALL_VALUE,
        transactionName: ALL_VALUE,
        transactionType: ALL_VALUE,
      });
      const filters = buildApmSourceFilters({ type: indicator.type, params: indicator.params });
      expect(filters).toEqual([]);
    });

    it('includes KQL filter when filter is truthy', () => {
      const indicator = createAPMTransactionDurationIndicator({
        service: ALL_VALUE,
        environment: ALL_VALUE,
        transactionName: ALL_VALUE,
        transactionType: ALL_VALUE,
        filter: 'host.name: "my-host"',
      });
      const filters = buildApmSourceFilters({ type: indicator.type, params: indicator.params });
      expect(filters).toHaveLength(1);
      expect(filters[0]).toHaveProperty('bool');
    });
  });

  describe('buildApmExtraGroupByFields', () => {
    it('returns terms entries for each non-ALL_VALUE param', () => {
      const indicator = createAPMTransactionDurationIndicator({
        service: 'my-service',
        environment: 'production',
        transactionName: 'GET /api',
        transactionType: 'request',
      });
      const fields = buildApmExtraGroupByFields({ type: indicator.type, params: indicator.params });
      expect(fields).toEqual({
        'service.name': { terms: { field: 'service.name' } },
        'service.environment': { terms: { field: 'service.environment' } },
        'transaction.name': { terms: { field: 'transaction.name' } },
        'transaction.type': { terms: { field: 'transaction.type' } },
      });
    });

    it('returns empty object when all params are ALL_VALUE', () => {
      const indicator = createAPMTransactionDurationIndicator({
        service: ALL_VALUE,
        environment: ALL_VALUE,
        transactionName: ALL_VALUE,
        transactionType: ALL_VALUE,
      });
      const fields = buildApmExtraGroupByFields({ type: indicator.type, params: indicator.params });
      expect(fields).toEqual({});
    });

    it('includes only non-ALL_VALUE fields', () => {
      const indicator = createAPMTransactionDurationIndicator({
        service: 'my-service',
        environment: ALL_VALUE,
        transactionName: ALL_VALUE,
        transactionType: 'request',
      });
      const fields = buildApmExtraGroupByFields({ type: indicator.type, params: indicator.params });
      expect(fields).toEqual({
        'service.name': { terms: { field: 'service.name' } },
        'transaction.type': { terms: { field: 'transaction.type' } },
      });
    });
  });
});
