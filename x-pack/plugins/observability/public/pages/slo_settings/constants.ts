import { SLOSettingsForm } from './types';

export const SLO_SETTINGS_DEFAULT_VALUES: SLOSettingsForm = {
  stale: {
    enabled: false,
    duration: 48 * 60, // 2 days expressed in minutes
  },
};
