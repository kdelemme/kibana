export interface SLOSettingsForm {
  stale: {
    enabled: boolean;
    duration: number; // minutes
  };
}
