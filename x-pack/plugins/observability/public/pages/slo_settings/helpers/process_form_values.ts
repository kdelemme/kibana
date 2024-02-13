import { GetSLOSettingsResponse, UpdateSLOSettingsParams } from '@kbn/slo-schema';
import { SLOSettingsForm } from '../types';

export function transformSloSettingsResponseToFormValues(
  settings?: GetSLOSettingsResponse
): SLOSettingsForm | undefined {
  if (!settings) return undefined;

  return {
    stale: {
      enabled: settings.stale.enabled,
      duration: settings.stale.duration,
    },
  };
}

export function transformFormValuesToUpdateSloSettingsParams(
  values: SLOSettingsForm
): UpdateSLOSettingsParams {
  return {
    stale: {
      enabled: values.stale.enabled,
      duration: values.stale.duration,
    },
  };
}
