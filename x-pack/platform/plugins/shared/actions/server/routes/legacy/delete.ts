/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { schema } from '@kbn/config-schema';
import type { UsageCounter } from '@kbn/usage-collection-plugin/server';
import type { IRouter } from '@kbn/core/server';
import type { ILicenseState } from '../../lib';
import { verifyApiAccess, isErrorThatHandlesItsOwnResponse } from '../../lib';
import { BASE_ACTION_API_PATH } from '../../../common';
import type { ActionsRequestHandlerContext } from '../../types';
import { trackLegacyRouteUsage } from '../../lib/track_legacy_route_usage';

const paramSchema = schema.object({
  id: schema.string({
    meta: { description: 'An identifier for the connector.' },
  }),
});

export const deleteActionRoute = (
  router: IRouter<ActionsRequestHandlerContext>,
  licenseState: ILicenseState,
  usageCounter?: UsageCounter
) => {
  router.delete(
    {
      path: `${BASE_ACTION_API_PATH}/action/{id}`,
      options: {
        access: 'public',
        summary: `Delete a connector`,
        description: 'WARNING: When you delete a connector, it cannot be recovered.',
        tags: ['oas-tag:connectors'],
        deprecated: {
          documentationUrl:
            'https://www.elastic.co/docs/api/doc/kibana/v8/operation/operation-legacydeleteconnector',
          severity: 'warning',
          reason: {
            type: 'migrate',
            newApiPath: `${BASE_ACTION_API_PATH}/connector/{id}`,
            newApiMethod: 'DELETE',
          },
        },
      },
      validate: {
        request: {
          params: paramSchema,
        },
        response: {
          204: {
            description: 'Indicates a successful call.',
          },
        },
      },
    },
    router.handleLegacyErrors(async function (context, req, res) {
      verifyApiAccess(licenseState);
      if (!context.actions) {
        return res.badRequest({ body: 'RouteHandlerContext is not registered for actions' });
      }
      const actionsClient = (await context.actions).getActionsClient();
      const { id } = req.params;
      trackLegacyRouteUsage('delete', usageCounter);
      try {
        await actionsClient.delete({ id });
        return res.noContent();
      } catch (e) {
        if (isErrorThatHandlesItsOwnResponse(e)) {
          return e.sendResponse(res);
        }
        throw e;
      }
    })
  );
};
