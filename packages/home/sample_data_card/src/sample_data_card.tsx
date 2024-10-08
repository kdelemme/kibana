/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import React from 'react';
import { useEuiTheme } from '@elastic/eui';

import type { SampleDataSet } from '@kbn/home-sample-data-types';
import { SampleDataCard as Component, Props as ComponentProps } from './sample_data_card.component';

/**
 * Props for the `SampleDataCard` component.
 */
export interface Props extends Pick<ComponentProps, 'onStatusChange'> {
  /** A Sample Data Set to display. */
  sampleDataSet: SampleDataSet;
}

/**
 * A card representing a Sample Data Set that can be installed.  Uses Kibana services to
 * display and install the data set.  Requires a `SampleDataCardProvider` to render and
 * function.
 */
export const SampleDataCard = ({ sampleDataSet, onStatusChange }: Props) => {
  const { colorMode } = useEuiTheme();
  const { darkPreviewImagePath, previewImagePath } = sampleDataSet;
  const imagePath =
    colorMode === 'DARK' && darkPreviewImagePath ? darkPreviewImagePath : previewImagePath;

  return <Component {...{ sampleDataSet, imagePath, onStatusChange }} />;
};
