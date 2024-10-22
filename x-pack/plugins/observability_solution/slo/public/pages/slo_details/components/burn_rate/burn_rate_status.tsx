/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import {
  EuiFlexGroup,
  EuiFlexItem,
  EuiLoadingSpinner,
  EuiPanel,
  EuiStat,
  EuiText,
  EuiTextColor,
} from '@elastic/eui';
import numeral from '@elastic/numeral';
import { i18n } from '@kbn/i18n';
import React from 'react';
import { BurnRateWindow } from '../../hooks/use_fetch_burn_rate_windows';

export interface BurnRateParams {
  isLoading: boolean;
  selectedWindow: BurnRateWindow;
  longWindowBurnRate: number;
  shortWindowBurnRate: number;
}

type Status = 'BREACHED' | 'RECOVERING' | 'INCREASING' | 'ACCEPTABLE';

export function BurnRateStatus({
  selectedWindow,
  longWindowBurnRate,
  shortWindowBurnRate,
  isLoading,
}: BurnRateParams) {
  const threshold = selectedWindow.threshold;
  const status = getStatus(threshold, longWindowBurnRate, shortWindowBurnRate);
  const color = getColor(status);

  if (isLoading) {
    return <EuiLoadingSpinner size="m" />;
  }

  return (
    <EuiPanel color={color} hasShadow={false}>
      <EuiFlexGroup justifyContent="spaceBetween" direction="column" style={{ minHeight: '100%' }}>
        <EuiFlexGroup direction="column" gutterSize="xs">
          <EuiFlexItem>
            <EuiText color="default" size="m">
              <h5>{getTitle(status)}</h5>
            </EuiText>
          </EuiFlexItem>
          <EuiFlexItem>
            <EuiText color="subdued" size="s">
              {getSubtitle(shortWindowBurnRate, longWindowBurnRate, selectedWindow)}
            </EuiText>
          </EuiFlexItem>
        </EuiFlexGroup>

        <EuiFlexGroup direction="row" justifyContent="flexEnd" alignItems="flexEnd">
          <EuiFlexItem grow={false}>
            <EuiStat
              title={`${numeral(threshold).format('0.[00]')}x`}
              titleColor="default"
              titleSize="s"
              textAlign="right"
              isLoading={isLoading}
              data-test-subj="burnRateThreshold"
              description={
                <EuiTextColor color="default">
                  <span>
                    {i18n.translate('xpack.slo.burnRate.thresholdLabel', {
                      defaultMessage: 'Threshold',
                    })}
                  </span>
                </EuiTextColor>
              }
            />
          </EuiFlexItem>
        </EuiFlexGroup>
      </EuiFlexGroup>
    </EuiPanel>
  );
}

function getStatus(
  threshold: number,
  longWindowBurnRate: number,
  shortWindowBurnRate: number
): Status {
  const isLongWindowBurnRateAboveThreshold = longWindowBurnRate > threshold;
  const isShortWindowBurnRateAboveThreshold = shortWindowBurnRate > threshold;
  const areBothBurnRatesAboveThreshold =
    isLongWindowBurnRateAboveThreshold && isShortWindowBurnRateAboveThreshold;

  return areBothBurnRatesAboveThreshold
    ? 'BREACHED'
    : isLongWindowBurnRateAboveThreshold && !isShortWindowBurnRateAboveThreshold
    ? 'RECOVERING'
    : !isLongWindowBurnRateAboveThreshold && isShortWindowBurnRateAboveThreshold
    ? 'INCREASING'
    : 'ACCEPTABLE';
}

function getColor(status: Status) {
  return status === 'BREACHED' ? 'danger' : status === 'INCREASING' ? 'warning' : 'success';
}

function getTitle(status: Status): string {
  switch (status) {
    case 'BREACHED':
      return i18n.translate('xpack.slo.burnRate.breachedStatustTitle', {
        defaultMessage: 'Breached',
      });
    case 'INCREASING':
      return i18n.translate('xpack.slo.burnRate.increasingStatustTitle', {
        defaultMessage: 'Increasing',
      });
    case 'RECOVERING':
      return i18n.translate('xpack.slo.burnRate.recoveringStatustTitle', {
        defaultMessage: 'Recovering',
      });
    case 'ACCEPTABLE':
    default:
      return i18n.translate('xpack.slo.burnRate.okStatusTitle', {
        defaultMessage: 'Acceptable value',
      });
  }
}

function getSubtitle(
  shortWindowBurnRate: number,
  longWindowBurnRate: number,
  selectedWindow: BurnRateWindow
): string {
  return i18n.translate('xpack.slo.burnRate.subtitle', {
    defaultMessage:
      'The {longWindowDuration} burn rate is {longWindowBurnRate}x and the {shortWindowDuration} burn rate is {shortWindowBurnRate}x.',
    values: {
      longWindowDuration: `${selectedWindow.longWindow.value}${selectedWindow.longWindow.unit}`,
      longWindowBurnRate: numeral(longWindowBurnRate).format('0.[00]'),
      shortWindowDuration: `${selectedWindow.shortWindow.value}${selectedWindow.shortWindow.unit}`,
      shortWindowBurnRate: numeral(shortWindowBurnRate).format('0.[00]'),
    },
  });
}
