/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { type DataViewListItem } from '@kbn/data-views-plugin/public';
import { useMemo } from 'react';
import { useSelector } from 'react-redux';
import { sharedStateSelector } from '../redux/selectors';
import { DEFAULT_SECURITY_SOLUTION_DATA_VIEW_ID } from '../constants';

export const useSavedDataViews = () => {
  const { dataViews } = useSelector(sharedStateSelector);

  return useMemo(() => {
    const savedViewsAsListItems: DataViewListItem[] = dataViews
      .filter((dv) => dv.id !== DEFAULT_SECURITY_SOLUTION_DATA_VIEW_ID)
      .map((spec) => ({
        id: spec.id ?? '',
        title: spec.title ?? '',
        name: spec.name,
      }));

    return savedViewsAsListItems;
  }, [dataViews]);
};
