/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { IHttpFetchError, ResponseErrorBody } from '@kbn/core/public';
import { i18n } from '@kbn/i18n';
import type { UpdateSLOSettingsParams } from '@kbn/slo-schema';
import { useMutation } from '@tanstack/react-query';
import { useKibana } from '../../utils/kibana_react';

type ServerError = IHttpFetchError<ResponseErrorBody>;

export function useUpdateSloSettings() {
  const {
    http,
    notifications: { toasts },
  } = useKibana().services;

  return useMutation<VoidFunction, ServerError, UpdateSLOSettingsParams>(
    ['updateSloSettings'],
    (settings) => {
      const body = JSON.stringify(settings);
      return http.put(`/internal/observability/slos/_settings`, { body });
    },
    {
      onSuccess: (_data) => {
        toasts.addSuccess(
          i18n.translate('xpack.observability.sloSettings.update.successNotification', {
            defaultMessage: 'Successfully updated',
          })
        );
      },
      onError: (error) => {
        toasts.addError(new Error(error.body?.message ?? error.message), {
          title: i18n.translate('xpack.observability.sloSettings.update.errorNotification', {
            defaultMessage: 'Something went wrong when updating the settings',
          }),
        });
      },
    }
  );
}
