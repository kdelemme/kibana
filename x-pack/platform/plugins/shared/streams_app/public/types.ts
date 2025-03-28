/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */
import { ChartsPluginStart } from '@kbn/charts-plugin/public';
import { AppMountParameters } from '@kbn/core/public';
import type { DataPublicPluginSetup, DataPublicPluginStart } from '@kbn/data-plugin/public';
import type {
  DataViewsPublicPluginSetup,
  DataViewsPublicPluginStart,
} from '@kbn/data-views-plugin/public';
import { DiscoverStart } from '@kbn/discover-plugin/public';
import {
  DiscoverSharedPublicSetup,
  DiscoverSharedPublicStart,
} from '@kbn/discover-shared-plugin/public';
import { FieldsMetadataPublicStart } from '@kbn/fields-metadata-plugin/public';
import { IndexManagementPluginStart } from '@kbn/index-management-shared-types';
import { IngestPipelinesPluginStart } from '@kbn/ingest-pipelines-plugin/public';
import { LicensingPluginStart } from '@kbn/licensing-plugin/public';
import { NavigationPublicStart } from '@kbn/navigation-plugin/public/types';
import {
  ObservabilityAIAssistantPublicSetup,
  ObservabilityAIAssistantPublicStart,
} from '@kbn/observability-ai-assistant-plugin/public';
import type { SavedObjectTaggingPluginStart } from '@kbn/saved-objects-tagging-plugin/public';
import type { SharePublicSetup, SharePublicStart } from '@kbn/share-plugin/public/plugin';
import type { StreamsPluginSetup, StreamsPluginStart } from '@kbn/streams-plugin/public';
import type { UnifiedSearchPublicPluginStart } from '@kbn/unified-search-plugin/public';

/* eslint-disable @typescript-eslint/no-empty-interface*/
export interface ConfigSchema {}

export interface StreamsApplicationProps {
  appMountParameters: AppMountParameters;
  PageTemplate: React.FC<React.PropsWithChildren<{}>>;
}

export type StreamsApplicationComponentType = React.FC<StreamsApplicationProps>;

export interface StreamsAppSetupDependencies {
  streams: StreamsPluginSetup;
  data: DataPublicPluginSetup;
  dataViews: DataViewsPublicPluginSetup;
  discoverShared: DiscoverSharedPublicSetup;
  unifiedSearch: {};
  share: SharePublicSetup;
  observabilityAIAssistant?: ObservabilityAIAssistantPublicSetup;
}

export interface StreamsAppStartDependencies {
  streams: StreamsPluginStart;
  charts: ChartsPluginStart;
  data: DataPublicPluginStart;
  dataViews: DataViewsPublicPluginStart;
  discover?: DiscoverStart;
  unifiedSearch: UnifiedSearchPublicPluginStart;
  share: SharePublicStart;
  savedObjectsTagging: SavedObjectTaggingPluginStart;
  navigation: NavigationPublicStart;
  fieldsMetadata: FieldsMetadataPublicStart;
  discoverShared: DiscoverSharedPublicStart;
  observabilityAIAssistant?: ObservabilityAIAssistantPublicStart;
  licensing: LicensingPluginStart;
  indexManagement: IndexManagementPluginStart;
  ingestPipelines: IngestPipelinesPluginStart;
}

export interface StreamsAppPublicSetup {}

export interface StreamsAppPublicStart {
  createStreamsApplicationComponent: () => StreamsApplicationComponentType;
}
