/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { GetSLOSettingsResponse } from '@kbn/slo-schema';
import { useQuery } from '@tanstack/react-query';
import { useKibana } from '../../utils/kibana_react';
import { sloKeys } from './query_key_factory';

export interface UseFetchSloSettingsResponse {
  isLoading: boolean;
  isSuccess: boolean;
  isError: boolean;
  data: GetSLOSettingsResponse | undefined;
}

export function useFetchSloSettings(): UseFetchSloSettingsResponse {
  const { http } = useKibana().services;

  const { isLoading, isError, isSuccess, data } = useQuery({
    queryKey: sloKeys.settings(),
    queryFn: async ({ signal }) => {
      try {
        const response = await http.get<GetSLOSettingsResponse>(
          `/internal/observability/slos/_settings`,
          { query: {}, signal }
        );

        return response;
      } catch (error) {
        // ignore error
      }
    },
    refetchOnWindowFocus: false,
  });

  return {
    data,
    isLoading,
    isSuccess,
    isError,
  };
}
