/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { elasticsearchServiceMock } from '@kbn/core/server/mocks';
import { loggerMock } from '@kbn/logging-mocks';
import {
  SLO_COMPONENT_TEMPLATE_MAPPINGS_NAME,
  SLO_COMPONENT_TEMPLATE_SETTINGS_NAME,
  SLO_INDEX_TEMPLATE_NAME,
  SLO_INGEST_PIPELINE_NAME,
  SLO_SUMMARY_COMPONENT_TEMPLATE_MAPPINGS_NAME,
  SLO_SUMMARY_COMPONENT_TEMPLATE_SETTINGS_NAME,
  SLO_SUMMARY_INDEX_TEMPLATE_NAME,
  SLO_SUMMARY_INGEST_PIPELINE_NAME,
} from '../../assets/constants';
import { getSLOSummaryEnrichPolicy } from '../../assets/enrich_policies/slo_summary_enrich_policy';
import { DefaultResourceInstaller } from './resource_installer';

describe('resourceInstaller', () => {
  it('installs the common resources', async () => {
    const mockClusterClient = elasticsearchServiceMock.createElasticsearchClient();
    mockClusterClient.indices.getIndexTemplate.mockResponseOnce({ index_templates: [] });
    mockClusterClient.enrich.getPolicy.mockResponseOnce({
      policies: [],
    });
    const installer = new DefaultResourceInstaller(mockClusterClient, loggerMock.create());

    await installer.ensureCommonResourcesInstalled();

    expect(mockClusterClient.cluster.putComponentTemplate).toHaveBeenCalledTimes(4);
    expect(mockClusterClient.cluster.putComponentTemplate).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ name: SLO_COMPONENT_TEMPLATE_MAPPINGS_NAME })
    );
    expect(mockClusterClient.cluster.putComponentTemplate).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ name: SLO_COMPONENT_TEMPLATE_SETTINGS_NAME })
    );
    expect(mockClusterClient.cluster.putComponentTemplate).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({ name: SLO_SUMMARY_COMPONENT_TEMPLATE_MAPPINGS_NAME })
    );
    expect(mockClusterClient.cluster.putComponentTemplate).toHaveBeenNthCalledWith(
      4,
      expect.objectContaining({ name: SLO_SUMMARY_COMPONENT_TEMPLATE_SETTINGS_NAME })
    );
    expect(mockClusterClient.indices.putIndexTemplate).toHaveBeenCalledTimes(2);
    expect(mockClusterClient.indices.putIndexTemplate).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ name: SLO_INDEX_TEMPLATE_NAME })
    );
    expect(mockClusterClient.indices.putIndexTemplate).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ name: SLO_SUMMARY_INDEX_TEMPLATE_NAME })
    );

    expect(mockClusterClient.enrich.putPolicy).toHaveBeenCalledWith(getSLOSummaryEnrichPolicy());

    expect(mockClusterClient.ingest.putPipeline).toHaveBeenCalledTimes(2);
    expect(mockClusterClient.ingest.putPipeline).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ id: SLO_INGEST_PIPELINE_NAME })
    );
    expect(mockClusterClient.ingest.putPipeline).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ id: SLO_SUMMARY_INGEST_PIPELINE_NAME })
    );
  });

  it('handles existing enrich policy correctly', async () => {
    const mockClusterClient = elasticsearchServiceMock.createElasticsearchClient();
    mockClusterClient.indices.getIndexTemplate.mockResponseOnce({ index_templates: [] });
    mockClusterClient.enrich.putPolicy.mockRejectedValue({
      meta: { body: { error: { type: 'resource_already_exists_exception' } } },
    });

    const installer = new DefaultResourceInstaller(mockClusterClient, loggerMock.create());

    await installer.ensureCommonResourcesInstalled();

    expect(mockClusterClient.enrich.putPolicy).toHaveBeenCalledWith(getSLOSummaryEnrichPolicy());
  });
});
