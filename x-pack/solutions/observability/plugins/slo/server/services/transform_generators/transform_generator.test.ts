/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { Duration, DurationUnit } from '../../domain/models';
import { twoMinute } from '../fixtures/duration';
import {
  createAPMTransactionErrorRateIndicator,
  createKQLCustomIndicator,
  createSLO,
  createSLOWithTimeslicesBudgetingMethod,
} from '../fixtures/slo';
import { ApmTransactionErrorRateTransformGenerator } from './apm_transaction_error_rate';
import { dataViewsService } from '@kbn/data-views-plugin/server/mocks';
import {
  getSLOPipelineId,
  getSLOTransformId,
  SLI_DESTINATION_INDEX_NAME,
} from '../../../common/constants';

const generator = new ApmTransactionErrorRateTransformGenerator(
  'my-space-id',
  dataViewsService,
  false
);

describe('Transform Generator', () => {
  describe('buildCommonGroupBy', () => {
    it('builds empty runtime mappings without group by', async () => {
      const slo = createSLO({
        id: 'irrelevant',
        indicator: createAPMTransactionErrorRateIndicator(),
      });

      const commonGroupBy = generator.buildCommonGroupBy(slo);
      expect(commonGroupBy).toMatchSnapshot();
    });

    it.each(['example', ['example'], ['example1', 'example2']])(
      'builds common groupBy with single group by',
      async (groupBy) => {
        const indicator = createAPMTransactionErrorRateIndicator();
        const slo = createSLO({
          id: 'irrelevant',
          groupBy,
          indicator,
        });

        const commonGroupBy = generator.buildCommonGroupBy(slo);
        expect(commonGroupBy).toMatchSnapshot();
      }
    );
  });

  describe('buildCommonRuntimeMappings', () => {
    it('builds empty runtime mappings without data view', async () => {
      const runtimeMappings = generator.buildCommonRuntimeMappings();
      expect(runtimeMappings).toEqual({});
    });
  });

  describe('buildTransformId', () => {
    it('returns the expected transform id', () => {
      const slo = createSLO({ id: 'test-id', revision: 3 });
      const transformId = generator.buildTransformId(slo);
      expect(transformId).toEqual(getSLOTransformId('test-id', 3));
    });
  });

  describe('buildDestination', () => {
    it('returns the expected destination', () => {
      const slo = createSLO({ id: 'test-id', revision: 2 });
      const destination = generator.buildDestination(slo);
      expect(destination).toEqual({
        pipeline: getSLOPipelineId('test-id', 2),
        index: SLI_DESTINATION_INDEX_NAME,
      });
    });
  });

  describe('buildDefaultSource', () => {
    it('returns the source and dataView', async () => {
      const slo = createSLO({
        id: 'irrelevant',
        indicator: createKQLCustomIndicator(),
      });
      const result = await generator.buildDefaultSource(slo, slo.indicator);
      expect(result.source).toMatchSnapshot();
      expect(result.dataView).toBeUndefined();
    });
  });

  describe('buildTimesliceAggregation', () => {
    it('returns empty object when budgeting method is occurrences', () => {
      const slo = createSLO();
      const result = generator.buildTimesliceAggregation(
        slo,
        'slo.numerator>_count',
        'slo.denominator>_count'
      );
      expect(result).toEqual({});
    });

    it('returns slo.isGoodSlice bucket_script when budgeting method is timeslices', () => {
      const slo = createSLOWithTimeslicesBudgetingMethod();
      const result = generator.buildTimesliceAggregation(
        slo,
        'slo.numerator>_count',
        'slo.denominator>_count'
      );
      expect(result).toMatchSnapshot();
    });

    it('uses > comparator when timesliceTarget is 0', () => {
      const slo = createSLOWithTimeslicesBudgetingMethod({
        objective: { target: 0.98, timesliceTarget: 0, timesliceWindow: twoMinute() },
      });
      const result = generator.buildTimesliceAggregation(
        slo,
        'slo.numerator>_count',
        'slo.denominator>_count'
      );
      expect(result).toMatchSnapshot();
    });
  });

  describe('settings', () => {
    const defaultSettings = {
      syncDelay: new Duration(10, DurationUnit.Minute),
      frequency: new Duration(2, DurationUnit.Minute),
      preventInitialBackfill: true,
    };

    it('builds the transform settings', async () => {
      const slo = createSLO({
        settings: {
          ...defaultSettings,
          syncField: 'my_timestamp_sync_field',
        },
      });
      const settings = generator.buildSettings(slo);
      expect(settings).toMatchSnapshot();
    });

    it('builds the transform settings using the provided settings.syncField', async () => {
      const slo = createSLO({
        settings: {
          ...defaultSettings,
          syncField: 'my_timestamp_sync_field',
        },
      });
      const settings = generator.buildSettings(slo, '@timestamp');
      expect(settings.sync_field).toEqual('my_timestamp_sync_field');
    });

    it('builds the transform settings using provided fallback when no settings.syncField is configured', async () => {
      const slo = createSLO({ settings: defaultSettings });
      const settings = generator.buildSettings(slo, '@timestamp2');
      expect(settings.sync_field).toEqual('@timestamp2');
    });

    it("builds the transform settings using '@timestamp' default fallback when no settings.syncField is configured", async () => {
      const slo = createSLO({ settings: defaultSettings });
      const settings = generator.buildSettings(slo);
      expect(settings.sync_field).toEqual('@timestamp');
    });
  });
});
