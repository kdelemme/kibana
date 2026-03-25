/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { useQuery } from '@kbn/react-query';
import { useService, CoreStart } from '@kbn/core-di-browser';
import { INTERNAL_ALERTING_V2_DATA_FIELDS_API_PATH } from '../constants';
import { matcherSuggestionKeys } from './query_key_factory';

export const useFetchDataFields = () => {
  const http = useService(CoreStart('http'));

  return useQuery<string[], Error>({
    queryKey: matcherSuggestionKeys.dataFields(),
    queryFn: () => http.get<string[]>(INTERNAL_ALERTING_V2_DATA_FIELDS_API_PATH),
    refetchOnWindowFocus: false,
    staleTime: 5 * 60 * 1000,
  });
};
