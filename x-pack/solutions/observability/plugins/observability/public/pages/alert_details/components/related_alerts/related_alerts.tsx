/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { EuiFlexGroup, EuiFlexItem } from '@elastic/eui';
import React, { useCallback, useEffect, useState } from 'react';
import { isRunningResponse } from '@kbn/data-plugin/common';
import { ObservabilityFields } from '../../../../../common/utils/alerting/types';
import { useKibana } from '../../../../utils/kibana_react';
import { TopAlert } from '../../../../typings/alerts';

interface Props {
  alert?: TopAlert<ObservabilityFields>;
}

export function RelatedAlerts({ alert }: Props) {
  const { data } = useKibana().services;
  const [rawResponse, setRawResponse] = useState<Record<string, any>>({});

  const search = useCallback(() => {
    data.search
      .search({
        params: {
          index: '.alerts-observability.*',
          _source: false,
          fields: [
            {
              field: 'kibana.alert.status',
              include_unmapped: true,
            },
            {
              field: 'kibana.alert.start',
              include_unmapped: true,
            },
            {
              field: 'kibana.alert.duration.us',
              include_unmapped: true,
            },
            {
              field: 'kibana.alert.rule.name',
              include_unmapped: true,
            },
            {
              field: 'kibana.alert.instance.id',
              include_unmapped: true,
            },
            {
              field: 'tags',
              include_unmapped: true,
            },
            {
              field: 'kibana.alert.reason',
              include_unmapped: true,
            },
            {
              field: 'kibana.alert.*',
              include_unmapped: false,
            },
          ],
          query: {
            bool: {
              must: [
                {
                  term: {
                    'kibana.alert.status': {
                      value: 'active',
                    },
                  },
                },
                {
                  terms: {
                    tags: ['prod', 'foo'],
                  },
                },
              ],
            },
          },
        },
      })
      .subscribe({
        next: (res) => {
          if (!isRunningResponse(res)) {
            setRawResponse(res.rawResponse);
          }
        },
        error: (e) => {},
      });
  }, [data]);

  useEffect(() => {
    search();
  }, [search]);

  return (
    <EuiFlexGroup direction="column">
      <EuiFlexItem>
        <pre>{JSON.stringify(rawResponse, null, 2)}</pre>
      </EuiFlexItem>
    </EuiFlexGroup>
  );
}
