/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { EuiButtonGroup, EuiFlexGroup, EuiFlexItem, EuiPanel, EuiTitle } from '@elastic/eui';
import { i18n } from '@kbn/i18n';
import { SLOWithSummaryResponse } from '@kbn/slo-schema';
import moment from 'moment';
import React, { useEffect, useState } from 'react';
import { ErrorRateChart } from '../../../../components/slo/error_rate_chart';
import { TimeRange } from '../../../../components/slo/error_rate_chart/use_lens_definition';
import { useFetchSloBurnRates } from '../../../../hooks/use_fetch_slo_burn_rates';
import { TimeBounds } from '../../types';
import { BurnRate } from './burn_rate';

interface Props {
  slo: SLOWithSummaryResponse;
  isAutoRefreshing?: boolean;
  burnRateOptions: BurnRateOption[];
  range?: TimeRange;
  onBrushed?: (timeBounds: TimeBounds) => void;
}

export interface BurnRateOption {
  id: string;
  label: string;
  windowName: string;
  threshold: number;
  duration: number;
  ariaLabel: string;
}

function getWindowsFromOptions(opts: BurnRateOption[]): Array<{ name: string; duration: string }> {
  return opts.map((opt) => ({ name: opt.windowName, duration: `${opt.duration}h` }));
}

export function BurnRates({ slo, isAutoRefreshing, burnRateOptions, range, onBrushed }: Props) {
  const [burnRateOption, setBurnRateOption] = useState(burnRateOptions[0]);
  const { isLoading, data } = useFetchSloBurnRates({
    slo,
    shouldRefetch: isAutoRefreshing,
    windows: getWindowsFromOptions(burnRateOptions),
  });

  useEffect(() => {
    if (burnRateOptions.length) {
      setBurnRateOption(burnRateOptions[0]);
    }
  }, [burnRateOptions]);

  const dataTimeRange = range ?? {
    from: moment().subtract(burnRateOption.duration, 'hour').toDate(),
    to: new Date(),
  };

  const threshold = burnRateOption.threshold;
  const burnRate = data?.burnRates.find(
    (curr) => curr.name === burnRateOption.windowName
  )?.burnRate;

  const onBurnRateOptionChange = (optionId: string) => {
    const selected = burnRateOptions.find((opt) => opt.id === optionId) ?? burnRateOptions[0];
    setBurnRateOption(selected);
  };

  return (
    <EuiPanel paddingSize="m" color="transparent" hasBorder data-test-subj="burnRatePanel">
      <EuiFlexGroup direction="column" gutterSize="m">
        <EuiFlexGroup justifyContent="spaceBetween">
          <EuiFlexItem grow={false}>
            <EuiTitle size="xs">
              <h2>
                {i18n.translate('xpack.slo.burnRates.h2.burnRatePanelTitle', {
                  defaultMessage: 'Burn rate',
                })}
              </h2>
            </EuiTitle>
          </EuiFlexItem>
          <EuiFlexItem grow={false}>
            <EuiButtonGroup
              legend={i18n.translate('xpack.slo.burnRate.timeRangeBtnLegend', {
                defaultMessage: 'Select the time range',
              })}
              options={burnRateOptions.map((opt) => ({
                id: opt.id,
                label: opt.label,
                'aria-label': opt.ariaLabel,
              }))}
              idSelected={burnRateOption.id}
              onChange={onBurnRateOptionChange}
              buttonSize="compressed"
            />
          </EuiFlexItem>
        </EuiFlexGroup>
        <EuiFlexGroup direction="row" gutterSize="m">
          <EuiFlexItem grow={1}>
            <BurnRate threshold={threshold} burnRate={burnRate} slo={slo} isLoading={isLoading} />
          </EuiFlexItem>

          <EuiFlexItem grow={3}>
            <ErrorRateChart
              slo={slo}
              dataTimeRange={dataTimeRange}
              threshold={threshold}
              onBrushed={onBrushed}
            />
          </EuiFlexItem>
        </EuiFlexGroup>
      </EuiFlexGroup>
    </EuiPanel>
  );
}
