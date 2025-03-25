/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import {
  getHostRiskIndex,
  getRiskIndex,
  getUserRiskIndex,
} from '../../../../../../common/search_strategy';
import { createHostRiskEnrichments } from './enrichment_by_type/host_risk';
import { createUserRiskEnrichments } from './enrichment_by_type/user_risk';
import {
  createHostAssetCriticalityEnrichments,
  createServiceAssetCriticalityEnrichments,
  createUserAssetCriticalityEnrichments,
} from './enrichment_by_type/asset_criticality';
import { getAssetCriticalityIndex } from '../../../../../../common/entity_analytics/asset_criticality';
import type { EnrichEvents, EventsMapByEnrichments } from './types';
import { applyEnrichmentsToEvents } from './utils/transforms';
import { isIndexExist } from './utils/is_index_exist';
import { createServiceRiskEnrichments } from './enrichment_by_type/service_risk';

export const enrichEvents: EnrichEvents = async ({
  services,
  logger,
  events,
  spaceId,
  experimentalFeatures,
}) => {
  try {
    const enrichments: Array<Promise<EventsMapByEnrichments>> = [];

    logger.debug('Alert enrichments started');
    const isNewRiskScoreModuleAvailable = experimentalFeatures?.riskScoringRoutesEnabled ?? false;

    let isNewRiskScoreModuleInstalled = false;
    if (isNewRiskScoreModuleAvailable) {
      isNewRiskScoreModuleInstalled = await isIndexExist({
        services,
        index: getHostRiskIndex(spaceId, true, true),
      });
    }

    const [isHostRiskScoreIndexExist, isUserRiskScoreIndexExist, isServiceRiskScoreIndexExist] =
      await Promise.all([
        isIndexExist({
          services,
          index: getHostRiskIndex(spaceId, true, isNewRiskScoreModuleInstalled),
        }),
        isIndexExist({
          services,
          index: getUserRiskIndex(spaceId, true, isNewRiskScoreModuleInstalled),
        }),
        isIndexExist({
          services,
          index: getRiskIndex(spaceId, true),
        }),
      ]);

    if (isHostRiskScoreIndexExist) {
      enrichments.push(
        createHostRiskEnrichments({
          services,
          logger,
          events,
          spaceId,
          isNewRiskScoreModuleInstalled,
        })
      );
    }
    if (isUserRiskScoreIndexExist) {
      enrichments.push(
        createUserRiskEnrichments({
          services,
          logger,
          events,
          spaceId,
          isNewRiskScoreModuleInstalled,
        })
      );
    }

    if (isServiceRiskScoreIndexExist) {
      enrichments.push(
        createServiceRiskEnrichments({
          services,
          logger,
          events,
          spaceId,
          isNewRiskScoreModuleInstalled,
        })
      );
    }

    const assetCriticalityIndexExist = await isIndexExist({
      services,
      index: getAssetCriticalityIndex(spaceId),
    });
    if (assetCriticalityIndexExist) {
      enrichments.push(
        createUserAssetCriticalityEnrichments({
          services,
          logger,
          events,
          spaceId,
        })
      );
      enrichments.push(
        createHostAssetCriticalityEnrichments({
          services,
          logger,
          events,
          spaceId,
        })
      );
      enrichments.push(
        createServiceAssetCriticalityEnrichments({
          services,
          logger,
          events,
          spaceId,
        })
      );
    }

    const allEnrichmentsResults = await Promise.allSettled(enrichments);

    const allFulfilledEnrichmentsResults: EventsMapByEnrichments[] = allEnrichmentsResults
      .filter((result) => result.status === 'fulfilled')
      .map((result) => (result as PromiseFulfilledResult<EventsMapByEnrichments>)?.value);

    return applyEnrichmentsToEvents({
      events,
      enrichmentsList: allFulfilledEnrichmentsResults,
      logger,
    });
  } catch (error) {
    logger.error(`Enrichments failed ${error}`);
    return events;
  }
};
