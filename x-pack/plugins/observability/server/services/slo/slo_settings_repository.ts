/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */
import { SavedObjectsClientContract } from '@kbn/core-saved-objects-api-server';
import {
  GetSLOSettingsResponse,
  getSLOSettingsResponseSchema,
  SLOSettingsStored,
  UpdateSLOSettingsParams,
} from '@kbn/slo-schema';
import { sloSettingsStoredSchema } from '@kbn/slo-schema/src/schema/slo_settings';
import { SO_SLO_SETTINGS_TYPE } from '../../saved_objects';

export class SLOSettingsRepository {
  constructor(private soClient: SavedObjectsClientContract) {}

  public async get(spaceId: string): Promise<GetSLOSettingsResponse> {
    const soSettings = await this.soClient.find<SLOSettingsStored>({
      type: SO_SLO_SETTINGS_TYPE,
      namespaces: [spaceId],
    });
    const settings = soSettings.saved_objects?.[0]?.attributes ?? {};

    return getSLOSettingsResponseSchema.encode({
      stale: {
        enabled: settings.stale?.enabled ?? false,
        duration: settings.stale?.duration ?? 10_080, // 7days
      },
    });
  }

  public async save(spaceId: string, params: UpdateSLOSettingsParams): Promise<void> {
    let existingSavedObjectId;
    const findResponse = await this.soClient.find<SLOSettingsStored>({
      type: SO_SLO_SETTINGS_TYPE,
      page: 1,
      perPage: 1,
      namespaces: [spaceId],
    });
    if (findResponse.total === 1) {
      existingSavedObjectId = findResponse.saved_objects[0].id;
    }

    await this.soClient.create<SLOSettingsStored>(
      SO_SLO_SETTINGS_TYPE,
      sloSettingsStoredSchema.encode(params),
      {
        id: existingSavedObjectId,
        overwrite: true,
      }
    );
  }
}
