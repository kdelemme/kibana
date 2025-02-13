/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { renderHook } from '@testing-library/react';
import { wrapper } from '../../../mocks';

import { useLensAttributes } from '../../../use_lens_attributes';

import { getAlertsHistogramLensAttributes } from './alerts_histogram';

jest.mock('uuid', () => ({
  v4: jest
    .fn()
    .mockReturnValueOnce('0039eb0c-9a1a-4687-ae54-0f4e239bec75')
    .mockReturnValueOnce('e09e0380-0740-4105-becc-0a4ca12e3944')
    .mockReturnValueOnce('34919782-4546-43a5-b668-06ac934d3acd')
    .mockReturnValueOnce('aac9d7d0-13a3-480a-892b-08207a787926'),
}));

jest.mock('../../../../../../sourcerer/containers', () => ({
  useSourcererDataView: jest.fn().mockReturnValue({
    dataViewId: 'security-solution-my-test',
    indicesExist: true,
    selectedPatterns: ['signal-index'],
  }),
}));

jest.mock('../../../../../utils/route/use_route_spy', () => ({
  useRouteSpy: jest.fn().mockReturnValue([
    {
      detailName: 'mockRule',
      pageName: 'rules',
      tabName: 'alerts',
    },
  ]),
}));

describe('getAlertsHistogramLensAttributes', () => {
  it('should render without extra options', () => {
    const { result } = renderHook(
      () =>
        useLensAttributes({
          getLensAttributes: getAlertsHistogramLensAttributes,
          stackByField: 'event.category',
        }),
      { wrapper }
    );

    expect(result?.current).toMatchSnapshot();
  });

  it('should render with extra options - filters', () => {
    const { result } = renderHook(
      () =>
        useLensAttributes({
          extraOptions: {
            filters: [
              {
                meta: {
                  type: 'phrases',
                  key: '_index',
                  params: ['.alerts-security.alerts-default'],
                  alias: null,
                  negate: false,
                  disabled: false,
                },
                query: {
                  bool: {
                    should: [
                      {
                        match_phrase: {
                          _index: '.alerts-security.alerts-default',
                        },
                      },
                    ],
                    minimum_should_match: 1,
                  },
                },
              },
            ],
          },
          getLensAttributes: getAlertsHistogramLensAttributes,
          stackByField: 'event.category',
        }),
      { wrapper }
    );

    expect(result?.current).toMatchSnapshot();
  });
});
