/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

/*
 * NOTICE: Do not edit this file manually.
 * This file is automatically generated by the OpenAPI Generator, @kbn/openapi-generator.
 *
 * info:
 *   title: Asset Criticality Common Schema
 *   version: 1
 */

import { z } from '@kbn/zod';

export type IdField = z.infer<typeof IdField>;
export const IdField = z.enum(['host.name', 'user.name', 'service.name']);
export type IdFieldEnum = typeof IdField.enum;
export const IdFieldEnum = IdField.enum;

export type AssetCriticalityRecordIdParts = z.infer<typeof AssetCriticalityRecordIdParts>;
export const AssetCriticalityRecordIdParts = z.object({
  /**
   * The ID value of the asset.
   */
  id_value: z.string(),
  /**
   * The field representing the ID.
   */
  id_field: IdField,
});

/**
 * The criticality level of the asset.
 */
export type AssetCriticalityLevel = z.infer<typeof AssetCriticalityLevel>;
export const AssetCriticalityLevel = z.enum([
  'low_impact',
  'medium_impact',
  'high_impact',
  'extreme_impact',
]);
export type AssetCriticalityLevelEnum = typeof AssetCriticalityLevel.enum;
export const AssetCriticalityLevelEnum = AssetCriticalityLevel.enum;

export type CreateAssetCriticalityRecord = z.infer<typeof CreateAssetCriticalityRecord>;
export const CreateAssetCriticalityRecord = AssetCriticalityRecordIdParts.merge(
  z.object({
    criticality_level: AssetCriticalityLevel,
  })
);

export type AssetCriticalityRecordEcsParts = z.infer<typeof AssetCriticalityRecordEcsParts>;
export const AssetCriticalityRecordEcsParts = z.object({
  asset: z.object({
    criticality: AssetCriticalityLevel.optional(),
  }),
  host: z
    .object({
      name: z.string(),
      asset: z
        .object({
          criticality: AssetCriticalityLevel,
        })
        .optional(),
    })
    .optional(),
  user: z
    .object({
      name: z.string(),
      asset: z
        .object({
          criticality: AssetCriticalityLevel,
        })
        .optional(),
    })
    .optional(),
  service: z
    .object({
      name: z.string(),
      asset: z
        .object({
          criticality: AssetCriticalityLevel,
        })
        .optional(),
    })
    .optional(),
});

export type AssetCriticalityRecord = z.infer<typeof AssetCriticalityRecord>;
export const AssetCriticalityRecord = CreateAssetCriticalityRecord.merge(
  AssetCriticalityRecordEcsParts
).merge(
  z.object({
    /**
     * The time the record was created or updated.
     */
    '@timestamp': z.string().datetime(),
  })
);
