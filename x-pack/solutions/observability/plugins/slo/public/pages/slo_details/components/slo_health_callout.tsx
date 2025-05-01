/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { EuiCallOut, EuiCopy, EuiFlexGroup, EuiFlexItem, EuiLink, EuiText } from '@elastic/eui';
import { i18n } from '@kbn/i18n';
import { FormattedMessage } from '@kbn/i18n-react';
import { encode } from '@kbn/rison';
import { SLOWithSummaryResponse } from '@kbn/slo-schema';
import React from 'react';
import { getSLOSummaryTransformId, getSLOTransformId } from '../../../../common/constants';
import { useFetchSloHealth } from '../../../hooks/use_fetch_slo_health';
import { useKibana } from '../../../hooks/use_kibana';

export function SloHealthCallout({ slo }: { slo: SLOWithSummaryResponse }) {
  const { http } = useKibana().services;
  const { isLoading, isError, data } = useFetchSloHealth({ list: [slo] });

  if (isLoading || isError || data === undefined || data?.length !== 1) {
    return null;
  }

  const health = data[0].health;
  if (health.overall === 'healthy') {
    return null;
  }

  const count = health.rollup === 'unhealthy' && health.summary === 'unhealthy' ? 2 : 1;

  return (
    <EuiCallOut
      color="danger"
      iconType="warning"
      title={i18n.translate('xpack.slo.sloDetails.healthCallout.title', {
        defaultMessage: 'This SLO has issues with its transforms',
      })}
    >
      <EuiFlexGroup direction="column" alignItems="flexStart">
        <EuiFlexItem>
          <FormattedMessage
            id="xpack.slo.sloDetails.healthCallout.description"
            defaultMessage="The following {count, plural, one {transform is} other {transforms are}
          } in an unhealthy state:"
            values={{ count }}
          />
          <ul>
            {health.rollup === 'unhealthy' && (
              <li>
                <EuiFlexGroup
                  direction="row"
                  alignItems="flexStart"
                  justifyContent="flexStart"
                  gutterSize="s"
                >
                  <EuiText size="s">{getSLOTransformId(slo.id, slo.revision)}</EuiText>
                  <EuiCopy textToCopy={getSLOTransformId(slo.id, slo.revision)}>
                    {(copy) => (
                      <EuiLink data-test-subj="sloHealthCalloutCopyLink" onClick={copy}>
                        {i18n.translate('xpack.slo.healthCallout.copyLinkLabel', {
                          defaultMessage: 'Copy',
                        })}
                      </EuiLink>
                    )}
                  </EuiCopy>

                  <EuiLink
                    data-test-subj="sloHealthCalloutViewTransformButton"
                    target="_blank"
                    href={http.basePath.prepend(
                      `/app/management/data/transform?_a=${encode({
                        transform: {
                          queryText: getSLOTransformId(slo.id, slo.revision),
                        },
                      })}`
                    )}
                  >
                    {i18n.translate('xpack.slo.healthCallout.viewTransformLinkLabel', {
                      defaultMessage: 'View Transform',
                    })}
                  </EuiLink>
                </EuiFlexGroup>
              </li>
            )}
            {health.summary === 'unhealthy' && (
              <li>
                <EuiFlexGroup
                  direction="row"
                  alignItems="flexStart"
                  justifyContent="flexStart"
                  gutterSize="s"
                >
                  <EuiText size="s">{getSLOSummaryTransformId(slo.id, slo.revision)}</EuiText>
                  <EuiCopy textToCopy={getSLOSummaryTransformId(slo.id, slo.revision)}>
                    {(copy) => (
                      <EuiLink data-test-subj="sloHealthCalloutCopyLink" onClick={copy}>
                        {i18n.translate('xpack.slo.healthCallout.copyLinkLabel', {
                          defaultMessage: 'Copy',
                        })}
                      </EuiLink>
                    )}
                  </EuiCopy>

                  <EuiLink
                    data-test-subj="sloHealthCalloutViewTransformButton"
                    target="_blank"
                    href={http.basePath.prepend(
                      `/app/management/data/transform?_a=${encode({
                        transform: {
                          queryText: getSLOSummaryTransformId(slo.id, slo.revision),
                        },
                      })}`
                    )}
                  >
                    {i18n.translate('xpack.slo.healthCallout.viewTransformLinkLabel', {
                      defaultMessage: 'View Transform',
                    })}
                  </EuiLink>
                </EuiFlexGroup>
              </li>
            )}
          </ul>
        </EuiFlexItem>
      </EuiFlexGroup>
    </EuiCallOut>
  );
}
