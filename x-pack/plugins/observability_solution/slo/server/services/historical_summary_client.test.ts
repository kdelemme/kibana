/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { ElasticsearchClientMock, elasticsearchServiceMock } from '@kbn/core/server/mocks';
import { ALL_VALUE } from '@kbn/slo-schema';
import moment from 'moment';
import { oneMinute, oneMonth, thirtyDays } from './fixtures/duration';
import { createSLO } from './fixtures/slo';
import {
  DefaultHistoricalSummaryClient,
  getFixedIntervalAndBucketsPerDay,
} from './historical_summary_client';

const commonEsResponse = {
  took: 100,
  timed_out: false,
  _shards: {
    total: 0,
    successful: 0,
    skipped: 0,
    failed: 0,
  },
  hits: {
    hits: [],
  },
};

const generateEsResponseForRollingSLO = (rollingDays: number = 30, timesliceInMin?: number) => {
  const { fixedInterval, bucketsPerDay } = getFixedIntervalAndBucketsPerDay(rollingDays);
  const doubleDuration = rollingDays * 2;
  const numberOfBuckets = doubleDuration * bucketsPerDay;
  const startDay = moment().subtract(doubleDuration, 'day').startOf('day');
  const bucketSizeInHour = moment
    .duration(
      fixedInterval.slice(0, -1),
      fixedInterval.slice(-1) as moment.unitOfTime.DurationConstructor
    )
    .asHours();

  const good = timesliceInMin ? Math.floor(((bucketSizeInHour * 60) / timesliceInMin) * 0.97) : 97;
  const total = timesliceInMin ? Math.floor((bucketSizeInHour * 60) / timesliceInMin) : 100;

  return {
    ...commonEsResponse,
    responses: [
      {
        ...commonEsResponse,
        aggregations: {
          daily: {
            buckets: Array(numberOfBuckets)
              .fill(0)
              .map((_, index) => ({
                key_as_string: startDay
                  .clone()
                  .add(index * bucketSizeInHour, 'hours')
                  .toISOString(),
                key: startDay
                  .clone()
                  .add(index * bucketSizeInHour, 'hours')
                  .format('x'),
                doc_count: 1440,
                total: {
                  value: total,
                },
                good: {
                  value: good,
                },
                cumulative_good: {
                  value:
                    index < rollingDays * bucketsPerDay
                      ? good * (index + 1)
                      : good * rollingDays * bucketsPerDay,
                },
                cumulative_total: {
                  value:
                    index < rollingDays * bucketsPerDay
                      ? total * (index + 1)
                      : total * rollingDays * bucketsPerDay,
                },
              })),
          },
        },
      },
    ],
  };
};

const generateEsResponseForMonthlyCalendarAlignedSLO = (good: number = 97, total: number = 100) => {
  const { fixedInterval, bucketsPerDay } = getFixedIntervalAndBucketsPerDay(30);
  const currentDayInMonth = 18;
  const numberOfBuckets = currentDayInMonth * bucketsPerDay;
  const bucketSize = Number(fixedInterval.slice(0, -1));
  const startDay = moment.utc().startOf('month');

  return {
    ...commonEsResponse,
    responses: [
      {
        ...commonEsResponse,
        aggregations: {
          daily: {
            buckets: Array(numberOfBuckets)
              .fill(0)
              .map((_, index) => ({
                key_as_string: startDay
                  .clone()
                  .add(index * bucketSize, 'hours')
                  .toISOString(),
                key: startDay
                  .clone()
                  .add(index * bucketSize, 'hours')
                  .format('x'),
                doc_count: 1440,
                total: {
                  value: total,
                },
                good: {
                  value: good,
                },
                cumulative_good: {
                  value: good * (index + 1),
                },
                cumulative_total: {
                  value: total * (index + 1),
                },
              })),
          },
        },
      },
    ],
  };
};

describe('FetchHistoricalSummary', () => {
  let esClientMock: ElasticsearchClientMock;

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2023-01-18T15:00:00.000Z'));
    esClientMock = elasticsearchServiceMock.createElasticsearchClient();
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  describe('Rolling and Occurrences SLOs', () => {
    it('returns the summary', async () => {
      const slo = createSLO({
        timeWindow: { type: 'rolling', duration: thirtyDays() },
        objective: { target: 0.95 },
        groupBy: ALL_VALUE,
      });
      esClientMock.msearch.mockResolvedValueOnce(generateEsResponseForRollingSLO(30));
      const client = new DefaultHistoricalSummaryClient(esClientMock);

      const results = await client.fetch({
        list: [
          {
            timeWindow: slo.timeWindow,
            groupBy: slo.groupBy,
            budgetingMethod: slo.budgetingMethod,
            objective: slo.objective,
            revision: slo.revision,
            sloId: slo.id,
            instanceId: ALL_VALUE,
          },
        ],
      });

      results[0].data.forEach((dailyResult) =>
        expect(dailyResult).toMatchSnapshot({ date: expect.any(Date) })
      );

      expect(results[0].data).toHaveLength(180);
    });
  });

  describe('Rolling and Timeslices SLOs', () => {
    it('returns the summary', async () => {
      const slo = createSLO({
        timeWindow: { type: 'rolling', duration: thirtyDays() },
        budgetingMethod: 'timeslices',
        objective: { target: 0.95, timesliceTarget: 0.9, timesliceWindow: oneMinute() },
        groupBy: ALL_VALUE,
      });
      esClientMock.msearch.mockResolvedValueOnce(generateEsResponseForRollingSLO(30, 1));
      const client = new DefaultHistoricalSummaryClient(esClientMock);

      const results = await client.fetch({
        list: [
          {
            timeWindow: slo.timeWindow,
            groupBy: slo.groupBy,
            budgetingMethod: slo.budgetingMethod,
            objective: slo.objective,
            revision: slo.revision,
            sloId: slo.id,
            instanceId: ALL_VALUE,
          },
        ],
      });

      results[0].data.forEach((dailyResult) =>
        expect(dailyResult).toMatchSnapshot({ date: expect.any(Date) })
      );
      expect(results[0].data).toHaveLength(180);
    });
  });

  describe('Calendar Aligned and Timeslices SLOs', () => {
    it('returns the summary', async () => {
      const slo = createSLO({
        timeWindow: {
          duration: oneMonth(),
          type: 'calendarAligned',
        },
        budgetingMethod: 'timeslices',
        objective: { target: 0.95, timesliceTarget: 0.9, timesliceWindow: oneMinute() },
      });
      esClientMock.msearch.mockResolvedValueOnce(generateEsResponseForMonthlyCalendarAlignedSLO());
      const client = new DefaultHistoricalSummaryClient(esClientMock);

      const results = await client.fetch({
        list: [
          {
            timeWindow: slo.timeWindow,
            groupBy: slo.groupBy,
            budgetingMethod: slo.budgetingMethod,
            objective: slo.objective,
            revision: slo.revision,
            sloId: slo.id,
            instanceId: ALL_VALUE,
          },
        ],
      });

      results[0].data.forEach((dailyResult) =>
        expect(dailyResult).toMatchSnapshot({ date: expect.any(Date) })
      );
      expect(results[0].data).toHaveLength(108);
    });
  });

  describe('Calendar Aligned and Occurrences SLOs', () => {
    it('returns the summary', async () => {
      const slo = createSLO({
        timeWindow: {
          duration: oneMonth(),
          type: 'calendarAligned',
        },
        budgetingMethod: 'occurrences',
        objective: { target: 0.95 },
      });
      esClientMock.msearch.mockResolvedValueOnce(generateEsResponseForMonthlyCalendarAlignedSLO());
      const client = new DefaultHistoricalSummaryClient(esClientMock);

      const results = await client.fetch({
        list: [
          {
            timeWindow: slo.timeWindow,
            groupBy: slo.groupBy,
            budgetingMethod: slo.budgetingMethod,
            objective: slo.objective,
            revision: slo.revision,
            sloId: slo.id,
            instanceId: ALL_VALUE,
          },
        ],
      });

      results[0].data.forEach((dailyResult) =>
        expect(dailyResult).toMatchSnapshot({ date: expect.any(Date) })
      );

      expect(results[0].data).toHaveLength(108);
    });
  });

  it("filters with the 'instanceId' when provided", async () => {
    const slo = createSLO({
      timeWindow: { type: 'rolling', duration: thirtyDays() },
      objective: { target: 0.95 },
      groupBy: 'host',
    });
    esClientMock.msearch.mockResolvedValueOnce(generateEsResponseForRollingSLO(30));
    const client = new DefaultHistoricalSummaryClient(esClientMock);

    const results = await client.fetch({
      list: [
        {
          timeWindow: slo.timeWindow,
          groupBy: slo.groupBy,
          budgetingMethod: slo.budgetingMethod,
          objective: slo.objective,
          revision: slo.revision,
          sloId: slo.id,
          instanceId: 'host-abc',
        },
      ],
    });

    expect(
      // @ts-ignore
      esClientMock.msearch.mock.calls[0][0].searches[1].query.bool.filter[3]
    ).toEqual({ term: { 'slo.instanceId': 'host-abc' } });

    results[0].data.forEach((dailyResult) =>
      expect(dailyResult).toMatchSnapshot({ date: expect.any(Date) })
    );
    expect(results[0].data).toHaveLength(180);
  });
});
