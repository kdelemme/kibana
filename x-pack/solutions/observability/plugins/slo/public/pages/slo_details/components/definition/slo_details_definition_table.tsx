/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import {
  EuiBasicTableColumn,
  EuiInMemoryTable,
  EuiPanel,
  EuiSearchBarProps,
  EuiText,
} from '@elastic/eui';
import numeral from '@elastic/numeral';
import { i18n } from '@kbn/i18n';
import {
  SLOWithSummaryResponse,
  occurrencesBudgetingMethodSchema,
  querySchema,
} from '@kbn/slo-schema';
import { map } from 'lodash';
import React from 'react';
import { useKibana } from '../../../../hooks/use_kibana';
import {
  BUDGETING_METHOD_OCCURRENCES,
  BUDGETING_METHOD_TIMESLICES,
  toDurationLabel,
  toIndicatorTypeLabel,
  toTimeWindowLabel,
} from '../../../../utils/slo/labels';
import { DisplayQuery } from './display_query';

export interface Props {
  slo: SLOWithSummaryResponse;
}

interface Row {
  field: string;
  value: React.ReactElement | string;
}

export function SloDetailsDefinitionTable({ slo }: Props) {
  const { uiSettings } = useKibana().services;
  const percentFormat = uiSettings.get('format:percent:defaultPattern');

  const items: Row[] = map(
    {
      name: <EuiText size="s">{slo.name}</EuiText>,
      description: <EuiText size="s">{slo.description}</EuiText>,
      tags: <EuiText size="s">{slo.tags.join(', ')}</EuiText>,
      budgetingMethod: occurrencesBudgetingMethodSchema.is(slo.budgetingMethod) ? (
        <EuiText size="s">{BUDGETING_METHOD_OCCURRENCES}</EuiText>
      ) : (
        <EuiText size="s">
          {BUDGETING_METHOD_TIMESLICES} (
          {slo.indicator.type === 'sli.metric.timeslice'
            ? i18n.translate(
                'xpack.slo.sloDetails.overview.timeslicesBudgetingMethodDetailsForTimesliceMetric',
                {
                  defaultMessage: '{duration} slices',
                  values: {
                    duration: toDurationLabel(slo.objective.timesliceWindow!),
                  },
                }
              )
            : i18n.translate('xpack.slo.sloDetails.overview.timeslicesBudgetingMethodDetails', {
                defaultMessage: '{duration} slices, {target} target',
                values: {
                  duration: toDurationLabel(slo.objective.timesliceWindow!),
                  target: numeral(slo.objective.timesliceTarget!).format(percentFormat),
                },
              })}
          )
        </EuiText>
      ),
      objective: (
        <EuiText size="s">
          {i18n.translate('xpack.slo.sloDetails.definitionTable.objective', {
            defaultMessage: '{target} objective',
            values: {
              target: numeral(slo.objective.target).format(percentFormat),
            },
          })}
        </EuiText>
      ),
      timeWindow: <EuiText size="s">{toTimeWindowLabel(slo.timeWindow)}</EuiText>,
      instanceId: slo.instanceId,
      groupBy: <EuiText size="s">{[slo.groupBy].flat().join(', ')}</EuiText>,

      'indicator.type': <EuiText size="s">{toIndicatorTypeLabel(slo.indicator.type)}</EuiText>,
      'indicator.params.index': <EuiText size="s">{slo.indicator.params.index}</EuiText>,
      'indicator.params.filter':
        'filter' in slo.indicator.params && querySchema.is(slo.indicator.params.filter) ? (
          <DisplayQuery query={slo.indicator.params.filter} index={slo.indicator.params.index} />
        ) : (
          '-'
        ),
      'indicator.params.good':
        'good' in slo.indicator.params && querySchema.is(slo.indicator.params.good) ? (
          <DisplayQuery query={slo.indicator.params.good} index={slo.indicator.params.index} />
        ) : (
          '-'
        ),
      'indicator.params.total':
        'total' in slo.indicator.params && querySchema.is(slo.indicator.params.total) ? (
          <DisplayQuery query={slo.indicator.params.total} index={slo.indicator.params.index} />
        ) : (
          '-'
        ),
      'settings.syncDelay': (
        <EuiText size="s">
          {slo.settings.syncDelay ? toDurationLabel(slo.settings.syncDelay) : '-'}
        </EuiText>
      ),
      'settings.syncField': (
        <EuiText size="s">{!!slo.settings.syncField ? slo.settings.syncField : '-'}</EuiText>
      ),
      'settings.frequency': (
        <EuiText size="s">
          {slo.settings.frequency ? toDurationLabel(slo.settings.frequency) : '-'}
        </EuiText>
      ),
      'settings.preventInitialBackfill': (
        <EuiText size="s">
          {slo.settings.preventInitialBackfill !== undefined
            ? JSON.stringify(slo.settings.preventInitialBackfill)
            : '-'}
        </EuiText>
      ),
    },
    (value, key) => ({ field: key, value })
  );

  const columns: Array<EuiBasicTableColumn<Row>> = [
    {
      field: 'field',
      name: i18n.translate('xpack.slo.sloDetails.definitionTable.field', {
        defaultMessage: 'Field',
      }),
      width: '30%',
    },
    {
      field: 'value',
      name: i18n.translate('xpack.slo.sloDetails.definitionTable.value', {
        defaultMessage: 'Value',
      }),
      render: (value: string) => {
        return value;
      },
    },
  ];

  const search: EuiSearchBarProps = {
    box: {
      incremental: true,
      schema: true,
    },
  };

  return (
    <EuiPanel paddingSize="none" color="transparent" data-test-subj="definition">
      <EuiInMemoryTable
        tableCaption="SLO Definition"
        responsiveBreakpoint={false}
        items={items}
        columns={columns}
        search={search}
        searchFormat={'text'}
        pagination={false}
        sorting={true}
      />
    </EuiPanel>
  );
}
