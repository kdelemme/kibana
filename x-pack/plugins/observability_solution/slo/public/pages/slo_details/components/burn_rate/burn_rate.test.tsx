/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { screen } from '@testing-library/react';
import React from 'react';

import { buildSlo } from '../../../../data/slo/slo';
import { render } from '../../../../utils/test_helper';
import { BurnRateStatus } from './burn_rate_status';

describe('BurnRate', () => {
  it("displays '--' when burn rate is 'undefined'", async () => {
    const slo = buildSlo();
    render(
      <BurnRateStatus slo={slo} threshold={14.4} longBurnRate={undefined} isLoading={false} />
    );

    expect(screen.queryByTestId('sloDetailsBurnRateStat')).toHaveTextContent('--');
  });

  it("displays the burn rate value when not 'undefined'", async () => {
    const slo = buildSlo();
    render(<BurnRateStatus slo={slo} threshold={14.4} longBurnRate={3.4} isLoading={false} />);

    expect(screen.queryByTestId('sloDetailsBurnRateStat')).toHaveTextContent('3.4x');
  });

  it("displays the burn rate value when '0'", async () => {
    const slo = buildSlo();
    render(<BurnRateStatus slo={slo} threshold={14.4} longBurnRate={0} isLoading={false} />);

    expect(screen.queryByTestId('sloDetailsBurnRateStat')).toHaveTextContent('0x');
  });
});
