/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

export const SLO_MODEL_VERSION = 2;
export const SLO_RESOURCES_VERSION = 3; // we were at 2
export const SLO_SUMMARY_TRANSFORMS_VERSION = 4; // we were at 3

export const SLO_COMPONENT_TEMPLATE_MAPPINGS_NAME = '.slo-observability.sli-mappings';
export const SLO_COMPONENT_TEMPLATE_SETTINGS_NAME = '.slo-observability.sli-settings';

export const SLO_INDEX_TEMPLATE_NAME = '.slo-observability.sli';
export const SLO_INDEX_TEMPLATE_PATTERN = `.slo-observability.sli-*`;

export const SLO_DESTINATION_INDEX_NAME = `.slo-observability.sli-v${SLO_RESOURCES_VERSION}`;
export const SLO_DESTINATION_INDEX_PATTERN = `.slo-observability.sli-v${SLO_RESOURCES_VERSION}*`;

export const SLO_INGEST_PIPELINE_NAME = `.slo-observability.sli.pipeline-v${SLO_RESOURCES_VERSION}`;
// slo-observability.sli-v<version>.(YYYY-MM-DD)
export const SLO_INGEST_PIPELINE_INDEX_NAME_PREFIX = `.slo-observability.sli-v${SLO_RESOURCES_VERSION}.`;

export const SLO_SUMMARY_COMPONENT_TEMPLATE_MAPPINGS_NAME = '.slo-observability.summary-mappings';
export const SLO_SUMMARY_COMPONENT_TEMPLATE_SETTINGS_NAME = '.slo-observability.summary-settings';
export const SLO_SUMMARY_INDEX_TEMPLATE_NAME = '.slo-observability.summary';
export const SLO_SUMMARY_INDEX_TEMPLATE_PATTERN = `.slo-observability.summary-*`;

export const SLO_SUMMARY_TRANSFORM_NAME_PREFIX = 'slo-summary-';
export const SLO_SUMMARY_DESTINATION_INDEX_NAME = `.slo-observability.summary-v${SLO_RESOURCES_VERSION}`; // store the temporary summary document generated by transform
export const SLO_SUMMARY_TEMP_INDEX_NAME = `.slo-observability.summary-v${SLO_RESOURCES_VERSION}.temp`; // store the temporary summary document
export const SLO_SUMMARY_DESTINATION_INDEX_PATTERN = `.slo-observability.summary-v${SLO_RESOURCES_VERSION}*`; // include temp and non-temp summary indices

export const SLO_SUMMARY_INGEST_PIPELINE_NAME = `.slo-observability.summary.pipeline-v${SLO_RESOURCES_VERSION}`;
export const SLO_SUMMARY_ENRICH_POLICY_NAME = `slo-observability.summary.enrich_policy`;

export const getSLOTransformId = (sloId: string, sloRevision: number) =>
  `slo-${sloId}-${sloRevision}`;
