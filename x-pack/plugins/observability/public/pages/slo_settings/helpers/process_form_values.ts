import { SLOSettingsForm } from '../types';

// TODO: replace with io-ts schema type
type GetSLOSettings = { stale: { enabled: boolean; duration: number } };

export function transformSloSettingsResponseToFormValues(
  settings?: GetSLOSettings
): SLOSettingsForm | undefined {
  if (!settings) return undefined;

  return {
    stale: {
      enabled: settings.stale.enabled,
      duration: settings.stale.duration,
    },
  };
}
