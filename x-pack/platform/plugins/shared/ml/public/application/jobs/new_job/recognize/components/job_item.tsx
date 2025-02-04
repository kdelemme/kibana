/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import type { FC } from 'react';
import React, { memo } from 'react';
import {
  useEuiTheme,
  EuiBadge,
  EuiButtonIcon,
  EuiFlexGroup,
  EuiFlexItem,
  EuiIcon,
  EuiLoadingSpinner,
  EuiText,
  EuiToolTip,
} from '@elastic/eui';
import { i18n } from '@kbn/i18n';
import { FormattedMessage } from '@kbn/i18n-react';
import { extractErrorMessage } from '@kbn/ml-error-utils';
import type { ModuleJobUI } from '../page';
import { SETUP_RESULTS_WIDTH } from './module_jobs';
import { tabColor } from '../../../../../../common/util/group_color_utils';
import type { JobOverride, DatafeedResponse } from '../../../../../../common/types/modules';

interface JobItemProps {
  job: ModuleJobUI;
  jobPrefix: string;
  jobOverride: JobOverride | undefined;
  isSaving: boolean;
  onEditRequest: (job: ModuleJobUI) => void;
}

export const JobItem: FC<JobItemProps> = memo(
  ({ job, jobOverride, isSaving, jobPrefix, onEditRequest }) => {
    const { euiTheme } = useEuiTheme();

    const {
      id,
      config: { description, groups },
      datafeedResult,
      setupResult,
    } = job;

    const jobGroups = (jobOverride && jobOverride.groups) || groups;

    return (
      <EuiFlexGroup
        alignItems="center"
        gutterSize="s"
        justifyContent="spaceBetween"
        responsive={false}
      >
        <EuiFlexItem>
          <EuiFlexGroup gutterSize="s">
            <EuiFlexItem grow={false}>
              <EuiText size="s" color="accentSecondary">
                {jobPrefix}
                {id}
              </EuiText>
            </EuiFlexItem>
            <EuiFlexItem grow={false}>
              <EuiToolTip
                position="right"
                content={
                  <FormattedMessage
                    id="xpack.ml.newJob.recognize.job.overrideJobConfigurationLabel"
                    defaultMessage="Override job configuration"
                  />
                }
              >
                <EuiButtonIcon
                  aria-label={i18n.translate(
                    'xpack.ml.newJob.recognize.job.overrideJobConfigurationLabel',
                    {
                      defaultMessage: 'Override job configuration',
                    }
                  )}
                  iconType="pencil"
                  onClick={() => onEditRequest(job)}
                />
              </EuiToolTip>
            </EuiFlexItem>
          </EuiFlexGroup>

          <EuiText size="s" color="subdued">
            {description}
          </EuiText>

          <EuiFlexGroup wrap responsive={false} gutterSize="xs">
            {(jobGroups ?? []).map((group) => (
              <EuiFlexItem grow={false} key={group}>
                <EuiBadge color={tabColor(group, euiTheme)}>{group}</EuiBadge>
              </EuiFlexItem>
            ))}
          </EuiFlexGroup>

          {setupResult && setupResult.error && (
            <EuiText size="xs" color="danger">
              {extractErrorMessage(setupResult.error)}
            </EuiText>
          )}

          {datafeedResult && datafeedResult.error && (
            <EuiText size="xs" color="danger">
              {extractErrorMessage(datafeedResult.error)}
            </EuiText>
          )}
        </EuiFlexItem>
        <EuiFlexItem grow={false} style={{ width: SETUP_RESULTS_WIDTH }}>
          {isSaving && <EuiLoadingSpinner size="m" />}
          {setupResult && datafeedResult && (
            <EuiFlexGroup
              gutterSize="s"
              wrap={false}
              responsive={false}
              justifyContent="spaceAround"
            >
              <EuiFlexItem grow={false}>
                <EuiIcon
                  type={setupResult.success ? 'check' : 'cross'}
                  color={setupResult.success ? 'success' : 'danger'}
                  size="m"
                  aria-label={
                    setupResult.success
                      ? i18n.translate('xpack.ml.newJob.recognize.job.savedAriaLabel', {
                          defaultMessage: 'Saved',
                        })
                      : i18n.translate('xpack.ml.newJob.recognize.job.saveFailedAriaLabel', {
                          defaultMessage: 'Save failed',
                        })
                  }
                />
              </EuiFlexItem>

              <EuiFlexItem grow={false}>
                <EuiIcon
                  type={datafeedResult.success ? 'check' : 'cross'}
                  color={datafeedResult.success ? 'success' : 'danger'}
                  size="m"
                  aria-label={
                    setupResult.success
                      ? i18n.translate('xpack.ml.newJob.recognize.datafeed.savedAriaLabel', {
                          defaultMessage: 'Saved',
                        })
                      : i18n.translate('xpack.ml.newJob.recognize.datafeed.saveFailedAriaLabel', {
                          defaultMessage: 'Save failed',
                        })
                  }
                />
              </EuiFlexItem>

              <EuiFlexItem grow={false}>
                <EuiIcon
                  type={getDatafeedStartedIcon(datafeedResult).type}
                  color={getDatafeedStartedIcon(datafeedResult).color}
                  size="m"
                  aria-label={
                    setupResult.success
                      ? i18n.translate('xpack.ml.newJob.recognize.running.startedAriaLabel', {
                          defaultMessage: 'Started',
                        })
                      : i18n.translate('xpack.ml.newJob.recognize.running.startFailedAriaLabel', {
                          defaultMessage: 'Start failed',
                        })
                  }
                />
              </EuiFlexItem>
            </EuiFlexGroup>
          )}
        </EuiFlexItem>
      </EuiFlexGroup>
    );
  }
);

function getDatafeedStartedIcon({ awaitingMlNodeAllocation, success }: DatafeedResponse): {
  type: string;
  color: string;
} {
  if (awaitingMlNodeAllocation === true) {
    return { type: 'warning', color: 'warning' };
  }

  return success ? { type: 'check', color: 'success' } : { type: 'cross', color: 'danger' };
}
