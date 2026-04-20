/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { EuiSplitPanel, EuiTitle } from '@elastic/eui';
import React from 'react';

interface Props {
  title: React.ReactNode;
  children: React.ReactNode;
}

export const SectionPanel = ({ title, children }: Props) => (
  <EuiSplitPanel.Outer borderRadius="m" hasShadow={true} hasBorder={true}>
    <EuiSplitPanel.Inner color="subdued">
      <EuiTitle size="xs">
        <h3>{title}</h3>
      </EuiTitle>
    </EuiSplitPanel.Inner>
    <EuiSplitPanel.Inner>{children}</EuiSplitPanel.Inner>
  </EuiSplitPanel.Outer>
);
