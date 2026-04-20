/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import {
  EuiBadge,
  EuiButton,
  EuiButtonEmpty,
  EuiCode,
  EuiDescriptionList,
  EuiFlexGroup,
  EuiFlexItem,
  EuiFlyout,
  EuiFlyoutBody,
  EuiFlyoutFooter,
  EuiFlyoutHeader,
  EuiSpacer,
  EuiSplitPanel,
  EuiText,
  EuiTitle,
  type EuiDescriptionListProps,
} from '@elastic/eui';
import type { ActionPolicyDestination, ActionPolicyResponse } from '@kbn/alerting-v2-schemas';
import { CoreStart, useService } from '@kbn/core-di-browser';
import { i18n } from '@kbn/i18n';
import { FormattedMessage } from '@kbn/i18n-react';
import moment from 'moment';
import React from 'react';
import { ActionPolicyStateBadge } from '../action_policy_state_badge';
import { isSnoozed } from '../is_snoozed';
import { getGroupingModeLabel, getThrottleStrategyLabel } from '../labels';
import { WorkflowDestinationLink } from '../workflow_destination_link';

const FLYOUT_TITLE_ID = 'actionPolicyDetailsFlyoutTitle';
const EMPTY_VALUE = '-';

interface ActionPolicyDetailsFlyoutProps {
  policy: ActionPolicyResponse;
  onClose: () => void;
  onEdit: (id: string) => void;
}

const SectionPanel = ({
  title,
  children,
}: {
  title: React.ReactNode;
  children: React.ReactNode;
}) => (
  <EuiSplitPanel.Outer borderRadius="m" hasShadow={true} hasBorder={true}>
    <EuiSplitPanel.Inner color="subdued">
      <EuiTitle size="xs">
        <h3>{title}</h3>
      </EuiTitle>
    </EuiSplitPanel.Inner>
    <EuiSplitPanel.Inner>{children}</EuiSplitPanel.Inner>
  </EuiSplitPanel.Outer>
);

const BadgeList = ({ items }: { items: string[] }) => (
  <EuiFlexGroup gutterSize="xs" wrap responsive={false}>
    {items.map((item) => (
      <EuiFlexItem grow={false} key={item}>
        <EuiBadge color="hollow">{item}</EuiBadge>
      </EuiFlexItem>
    ))}
  </EuiFlexGroup>
);

const DestinationRow = ({ destination }: { destination: ActionPolicyDestination }) => {
  if (destination.type === 'workflow') {
    return (
      <EuiFlexGroup gutterSize="s" alignItems="center" responsive={false}>
        <EuiFlexItem grow={false}>
          <EuiBadge color="hollow" iconType="workflow">
            <FormattedMessage
              id="xpack.alertingV2.actionPolicy.detailsFlyout.destination.workflow"
              defaultMessage="Workflow"
            />
          </EuiBadge>
        </EuiFlexItem>
        <EuiFlexItem grow={false}>
          <WorkflowDestinationLink id={destination.id} />
        </EuiFlexItem>
      </EuiFlexGroup>
    );
  }
  return null;
};

export const ActionPolicyDetailsFlyout = ({
  policy,
  onClose,
  onEdit,
}: ActionPolicyDetailsFlyoutProps) => {
  const settings = useService(CoreStart('settings'));
  const dateTimeFormat = settings.client.get<string>('dateFormat');
  const formatDate = (value: string) => moment(value).format(dateTimeFormat);

  const snoozedActive = isSnoozed(policy.snoozedUntil);

  const handleEdit = () => {
    onClose();
    onEdit(policy.id);
  };

  const basicInfoItems: EuiDescriptionListProps['listItems'] = [
    {
      title: i18n.translate('xpack.alertingV2.actionPolicy.detailsFlyout.basicInfo.description', {
        defaultMessage: 'Description',
      }),
      description: policy.description ? policy.description : EMPTY_VALUE,
    },
    {
      title: i18n.translate('xpack.alertingV2.actionPolicy.detailsFlyout.basicInfo.tags', {
        defaultMessage: 'Tags',
      }),
      description:
        policy.tags && policy.tags.length > 0 ? <BadgeList items={policy.tags} /> : EMPTY_VALUE,
    },
  ];

  const matchConditionsItems: EuiDescriptionListProps['listItems'] = [
    {
      title: i18n.translate('xpack.alertingV2.actionPolicy.detailsFlyout.matchConditions.matcher', {
        defaultMessage: 'Matcher',
      }),
      description: policy.matcher ? (
        <EuiCode>{policy.matcher}</EuiCode>
      ) : (
        <EuiText size="s" color="subdued">
          <FormattedMessage
            id="xpack.alertingV2.actionPolicy.detailsFlyout.matchConditions.matchesAll"
            defaultMessage="Matches all alerts."
          />
        </EuiText>
      ),
    },
  ];

  const dispatchItems: EuiDescriptionListProps['listItems'] = [
    {
      title: i18n.translate('xpack.alertingV2.actionPolicy.detailsFlyout.dispatch.mode', {
        defaultMessage: 'Dispatch per',
      }),
      description: getGroupingModeLabel(policy.groupingMode),
    },
  ];
  if (policy.groupingMode === 'per_field' && policy.groupBy && policy.groupBy.length > 0) {
    dispatchItems.push({
      title: i18n.translate('xpack.alertingV2.actionPolicy.detailsFlyout.dispatch.groupBy', {
        defaultMessage: 'Group by',
      }),
      description: <BadgeList items={policy.groupBy} />,
    });
  }
  dispatchItems.push({
    title: i18n.translate('xpack.alertingV2.actionPolicy.detailsFlyout.dispatch.frequency', {
      defaultMessage: 'Frequency',
    }),
    description: (
      <>
        {getThrottleStrategyLabel(policy.throttle?.strategy, policy.groupingMode)}
        {policy.throttle?.interval && (
          <>
            {' '}
            <EuiText size="xs" color="subdued">
              <FormattedMessage
                id="xpack.alertingV2.actionPolicy.detailsFlyout.dispatch.interval"
                defaultMessage="Every {interval}"
                values={{ interval: policy.throttle.interval }}
              />
            </EuiText>
          </>
        )}
      </>
    ),
  });

  const metadataItems: EuiDescriptionListProps['listItems'] = [
    {
      title: i18n.translate('xpack.alertingV2.actionPolicy.detailsFlyout.metadata.createdBy', {
        defaultMessage: 'Created by',
      }),
      description: policy.createdByUsername ?? EMPTY_VALUE,
    },
    {
      title: i18n.translate('xpack.alertingV2.actionPolicy.detailsFlyout.metadata.createdAt', {
        defaultMessage: 'Created at',
      }),
      description: formatDate(policy.createdAt),
    },
    {
      title: i18n.translate('xpack.alertingV2.actionPolicy.detailsFlyout.metadata.updatedBy', {
        defaultMessage: 'Updated by',
      }),
      description: policy.updatedByUsername ?? EMPTY_VALUE,
    },
    {
      title: i18n.translate('xpack.alertingV2.actionPolicy.detailsFlyout.metadata.updatedAt', {
        defaultMessage: 'Updated at',
      }),
      description: formatDate(policy.updatedAt),
    },
  ];

  return (
    <EuiFlyout
      onClose={onClose}
      aria-labelledby={FLYOUT_TITLE_ID}
      size="m"
      ownFocus
      data-test-subj="actionPolicyDetailsFlyout"
    >
      <EuiFlyoutHeader hasBorder>
        <EuiText size="xs" color="subdued">
          <FormattedMessage
            id="xpack.alertingV2.actionPolicy.detailsFlyout.eyebrow"
            defaultMessage="Action policy details"
          />
        </EuiText>
        <EuiTitle size="m">
          <h2 id={FLYOUT_TITLE_ID} data-test-subj="actionPolicyDetailsFlyoutTitle">
            {policy.name}
          </h2>
        </EuiTitle>
        <EuiSpacer size="s" />
        <EuiFlexGroup gutterSize="s" alignItems="center" responsive={false} wrap>
          <EuiFlexItem grow={false}>
            <ActionPolicyStateBadge policy={policy} isLoading={false} />
          </EuiFlexItem>
          {snoozedActive && policy.snoozedUntil && (
            <EuiFlexItem grow={false}>
              <EuiBadge color="accent" iconType="bellSlash">
                <FormattedMessage
                  id="xpack.alertingV2.actionPolicy.detailsFlyout.snoozedUntil"
                  defaultMessage="Snoozed until {date}"
                  values={{ date: formatDate(policy.snoozedUntil) }}
                />
              </EuiBadge>
            </EuiFlexItem>
          )}
        </EuiFlexGroup>
      </EuiFlyoutHeader>

      <EuiFlyoutBody>
        <SectionPanel
          title={
            <FormattedMessage
              id="xpack.alertingV2.actionPolicy.detailsFlyout.basicInfo.title"
              defaultMessage="Basic information"
            />
          }
        >
          <EuiDescriptionList compressed type="column" listItems={basicInfoItems} />
        </SectionPanel>

        <EuiSpacer size="m" />

        <SectionPanel
          title={
            <FormattedMessage
              id="xpack.alertingV2.actionPolicy.detailsFlyout.matchConditions.title"
              defaultMessage="Match conditions"
            />
          }
        >
          <EuiDescriptionList compressed type="column" listItems={matchConditionsItems} />
        </SectionPanel>

        <EuiSpacer size="m" />

        <SectionPanel
          title={
            <FormattedMessage
              id="xpack.alertingV2.actionPolicy.detailsFlyout.dispatch.title"
              defaultMessage="Dispatch"
            />
          }
        >
          <EuiDescriptionList compressed type="column" listItems={dispatchItems} />
        </SectionPanel>

        <EuiSpacer size="m" />

        <SectionPanel
          title={
            <FormattedMessage
              id="xpack.alertingV2.actionPolicy.detailsFlyout.destinations.title"
              defaultMessage="Destinations"
            />
          }
        >
          {policy.destinations.length === 0 ? (
            EMPTY_VALUE
          ) : (
            <EuiFlexGroup direction="column" gutterSize="s">
              {policy.destinations.map((destination) => (
                <EuiFlexItem key={`${destination.type}-${destination.id}`}>
                  <DestinationRow destination={destination} />
                </EuiFlexItem>
              ))}
            </EuiFlexGroup>
          )}
        </SectionPanel>

        <EuiSpacer size="m" />

        <SectionPanel
          title={
            <FormattedMessage
              id="xpack.alertingV2.actionPolicy.detailsFlyout.metadata.title"
              defaultMessage="Metadata"
            />
          }
        >
          <EuiDescriptionList compressed type="column" listItems={metadataItems} />
        </SectionPanel>
      </EuiFlyoutBody>

      <EuiFlyoutFooter>
        <EuiFlexGroup justifyContent="spaceBetween" responsive={false}>
          <EuiFlexItem grow={false}>
            <EuiButtonEmpty
              onClick={onClose}
              data-test-subj="detailsFlyoutCloseButton"
              iconType="cross"
            >
              <FormattedMessage
                id="xpack.alertingV2.actionPolicy.detailsFlyout.close"
                defaultMessage="Close"
              />
            </EuiButtonEmpty>
          </EuiFlexItem>
          <EuiFlexItem grow={false}>
            <EuiButton
              fill
              iconType="pencil"
              onClick={handleEdit}
              data-test-subj="detailsFlyoutEditButton"
              aria-label={i18n.translate(
                'xpack.alertingV2.actionPolicy.detailsFlyout.edit.ariaLabel',
                { defaultMessage: 'Edit this action policy' }
              )}
            >
              <FormattedMessage
                id="xpack.alertingV2.actionPolicy.detailsFlyout.edit"
                defaultMessage="Edit"
              />
            </EuiButton>
          </EuiFlexItem>
        </EuiFlexGroup>
      </EuiFlyoutFooter>
    </EuiFlyout>
  );
};
