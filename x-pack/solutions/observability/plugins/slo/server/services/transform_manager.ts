/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { TransformPutTransformRequest } from '@elastic/elasticsearch/lib/api/types';
import { IScopedClusterClient, Logger } from '@kbn/core/server';
import { IndicatorTypes, SLODefinition } from '../domain/models';
import { SecurityException } from '../errors';
import { retryTransientEsErrors } from '../utils/retry';
import { TransformGenerator } from './transform_generators';

type TransformId = string;

export interface TransformManager {
  install(slo: SLODefinition): Promise<TransformId>;
  inspect(slo: SLODefinition): Promise<TransformPutTransformRequest>;
  preview(transformId: TransformId): Promise<void>;
  start(transformId: TransformId): Promise<void>;
  stop(transformId: TransformId): Promise<void>;
  uninstall(transformId: TransformId): Promise<void>;
  getVersion(transformId: TransformId): Promise<number | undefined>;
}

export class DefaultTransformManager implements TransformManager {
  constructor(
    private generators: Record<IndicatorTypes, TransformGenerator>,
    private scopedClusterClient: IScopedClusterClient,
    private logger: Logger
  ) {}

  async install(slo: SLODefinition): Promise<TransformId> {
    const generator = this.generators[slo.indicator.type];
    if (!generator) {
      this.logger.debug(`No transform generator found for indicator type [${slo.indicator.type}]`);
      throw new Error(`Unsupported indicator type [${slo.indicator.type}]`);
    }

    const transformParams = await generator.getTransformParams(slo);
    try {
      await retryTransientEsErrors(
        () => this.scopedClusterClient.asSecondaryAuthUser.transform.putTransform(transformParams),
        {
          logger: this.logger,
        }
      );
    } catch (err) {
      this.logger.error(
        `Cannot create SLO transform for indicator type [${slo.indicator.type}]. ${err}`
      );
      if (err.meta?.body?.error?.type === 'security_exception') {
        throw new SecurityException(err.meta.body.error.reason);
      }

      throw err;
    }

    return transformParams.transform_id;
  }

  async inspect(slo: SLODefinition): Promise<TransformPutTransformRequest> {
    const generator = this.generators[slo.indicator.type];
    if (!generator) {
      this.logger.debug(`No transform generator found for indicator type [${slo.indicator.type}]`);
      throw new Error(`Unsupported indicator type [${slo.indicator.type}]`);
    }

    return await generator.getTransformParams(slo);
  }

  async preview(transformId: string): Promise<void> {
    try {
      await retryTransientEsErrors(
        () =>
          this.scopedClusterClient.asSecondaryAuthUser.transform.previewTransform({
            transform_id: transformId,
          }),
        { logger: this.logger }
      );
    } catch (err) {
      this.logger.error(`Cannot preview SLO transform [${transformId}]. ${err}`);
      throw err;
    }
  }

  async start(transformId: TransformId): Promise<void> {
    try {
      await retryTransientEsErrors(
        () =>
          this.scopedClusterClient.asSecondaryAuthUser.transform.startTransform(
            { transform_id: transformId },
            { ignore: [409] }
          ),
        { logger: this.logger }
      );
      await this.scheduleNowTransform(transformId);
    } catch (err) {
      this.logger.error(`Cannot start SLO transform [${transformId}]. ${err}`);
      throw err;
    }
  }

  async stop(transformId: TransformId): Promise<void> {
    try {
      await retryTransientEsErrors(
        () =>
          this.scopedClusterClient.asSecondaryAuthUser.transform.stopTransform(
            { transform_id: transformId, wait_for_completion: true, force: true },
            { ignore: [404] }
          ),
        { logger: this.logger }
      );
    } catch (err) {
      this.logger.error(`Cannot stop SLO transform [${transformId}]. ${err}`);
      throw err;
    }
  }

  async uninstall(transformId: TransformId): Promise<void> {
    try {
      await retryTransientEsErrors(
        () =>
          this.scopedClusterClient.asSecondaryAuthUser.transform.deleteTransform(
            { transform_id: transformId, force: true },
            { ignore: [404] }
          ),
        { logger: this.logger }
      );
    } catch (err) {
      this.logger.error(`Cannot delete SLO transform [${transformId}]. ${err}`);
      throw err;
    }
  }

  async getVersion(transformId: TransformId): Promise<number | undefined> {
    try {
      const response = await retryTransientEsErrors(
        () =>
          this.scopedClusterClient.asSecondaryAuthUser.transform.getTransform(
            { transform_id: transformId },
            { ignore: [404] }
          ),
        { logger: this.logger }
      );
      return response?.transforms[0]?._meta?.version;
    } catch (err) {
      this.logger.error(`Cannot retrieve SLO transform version [${transformId}]. ${err}`);
      throw err;
    }
  }

  async scheduleNowTransform(transformId: TransformId) {
    this.scopedClusterClient.asSecondaryAuthUser.transform
      .scheduleNowTransform({ transform_id: transformId })
      .then(() => {
        this.logger.debug(`SLO transform [${transformId}] scheduled now successfully`);
      })
      .catch((e) => {
        this.logger.error(`Cannot schedule now SLO transform [${transformId}]. ${e}`);
      });
  }
}
