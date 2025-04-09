/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import {
  CoreSetup,
  CoreStart,
  KibanaRequest,
  Logger,
  Plugin,
  PluginConfigDescriptor,
  PluginInitializerContext,
} from '@kbn/core/server';
import { registerRoutes } from '@kbn/server-route-repository';
import { StreamsConfig, configSchema, exposeToBrowserConfig } from '../common/config';
import { streamsRouteRepository } from './routes';
import {
  StreamsPluginSetupDependencies,
  StreamsPluginStartDependencies,
  StreamsServer,
} from './types';
import { AssetService } from './lib/streams/assets/asset_service';
import { RouteHandlerScopedClients } from './routes/types';
import { StreamsService } from './lib/streams/service';
import { StreamsTelemetryService } from './lib/telemetry/service';

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface StreamsPluginSetup {}
// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface StreamsPluginStart {}

export const config: PluginConfigDescriptor<StreamsConfig> = {
  schema: configSchema,
  exposeToBrowser: exposeToBrowserConfig,
};

export class StreamsPlugin
  implements
    Plugin<
      StreamsPluginSetup,
      StreamsPluginStart,
      StreamsPluginSetupDependencies,
      StreamsPluginStartDependencies
    >
{
  public config: StreamsConfig;
  public logger: Logger;
  public server?: StreamsServer;
  private isDev: boolean;
  private telemtryService = new StreamsTelemetryService();

  constructor(context: PluginInitializerContext<StreamsConfig>) {
    this.isDev = context.env.mode.dev;
    this.config = context.config.get();
    this.logger = context.logger.get();
  }

  public setup(
    core: CoreSetup<StreamsPluginStartDependencies>,
    plugins: StreamsPluginSetupDependencies
  ): StreamsPluginSetup {
    this.server = {
      config: this.config,
      logger: this.logger,
    } as StreamsServer;

    this.telemtryService.setup(core.analytics);

    const assetService = new AssetService(core, this.logger);
    const streamsService = new StreamsService(core, this.logger, this.isDev);

    registerRoutes({
      repository: streamsRouteRepository,
      dependencies: {
        assets: assetService,
        server: this.server,
        telemetry: this.telemtryService.getClient(),
        getScopedClients: async ({
          request,
        }: {
          request: KibanaRequest;
        }): Promise<RouteHandlerScopedClients> => {
          const [[coreStart, pluginsStart], assetClient] = await Promise.all([
            core.getStartServices(),
            assetService.getClientWithRequest({ request }),
          ]);

          const streamsClient = await streamsService.getClientWithRequest({ request, assetClient });

          const scopedClusterClient = coreStart.elasticsearch.client.asScoped(request);
          const soClient = coreStart.savedObjects.getScopedClient(request);
          const inferenceClient = pluginsStart.inference.getClient({ request });

          return { scopedClusterClient, soClient, assetClient, streamsClient, inferenceClient };
        },
      },
      core,
      logger: this.logger,
    });

    return {};
  }

  public start(core: CoreStart, plugins: StreamsPluginStartDependencies): StreamsPluginStart {
    if (this.server) {
      this.server.core = core;
      this.server.isServerless = core.elasticsearch.getCapabilities().serverless;
      this.server.security = plugins.security;
      this.server.encryptedSavedObjects = plugins.encryptedSavedObjects;
      this.server.taskManager = plugins.taskManager;
    }

    return {};
  }

  public stop() {}
}
