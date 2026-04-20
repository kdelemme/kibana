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
} from '@elastic/eui';
import type { ActionPolicyDestination, ActionPolicyResponse } from '@kbn/alerting-v2-schemas';
import { CoreStart, useService } from '@kbn/core-di-browser';
import { i18n } from '@kbn/i18n';
import { FormattedMessage } from '@kbn/i18n-react';
import moment from 'moment';
import React from 'react';
import { ActionPolicySnoozePopover } from '../action_policy_snooze_popover';
import { ActionPolicyStateBadge } from '../action_policy_state_badge';
import { DispatchConfigSummary } from '../form/components/dispatch_config_summary';
import { isSnoozed } from '../is_snoozed';
import { formatSnoozeFullDate } from '../action_policy_snooze_form';
import { getGroupingModeLabel, getThrottleStrategyLabel } from '../labels';
import { WorkflowDestinationLink } from '../workflow_destination_link';

const FLYOUT_TITLE_ID = 'actionPolicyDetailsFlyoutTitle';

interface ActionPolicyDetailsFlyoutProps {
  policy: ActionPolicyResponse;
  onClose: () => void;
  onEdit: (id: string) => void;
  onClone: (policy: ActionPolicyResponse) => void;
  onEnable: (id: string) => void;
  onDisable: (id: string) => void;
  onSnooze: (id: string, snoozedUntil: string) => void;
  onCancelSnooze: (id: string) => void;
  onDelete: (policy: ActionPolicyResponse) => void;
  isStateLoading?: boolean;
  isSnoozeLoading?: boolean;
}

const renderEmDash = () => <>&mdash;</>;

const SectionPanel = ({
  title,
  description,
  children,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  children: React.ReactNode;
}) => (
  <EuiSplitPanel.Outer borderRadius="m" hasShadow={true} hasBorder={true}>
    <EuiSplitPanel.Inner color="subdued">
      <EuiTitle size="xs">
        <h3>{title}</h3>
      </EuiTitle>
      {description && (
        <EuiText size="xs" color="subdued">
          {description}
        </EuiText>
      )}
    </EuiSplitPanel.Inner>
    <EuiSplitPanel.Inner>{children}</EuiSplitPanel.Inner>
  </EuiSplitPanel.Outer>
);

const FieldRow = ({ label, children }: { label: React.ReactNode; children: React.ReactNode }) => (
  <EuiFlexGroup gutterSize="s" direction="column">
    <EuiFlexItem>
      <EuiText size="xs" color="subdued">
        <strong>{label}</strong>
      </EuiText>
    </EuiFlexItem>
    <EuiFlexItem>
      <EuiText size="s">{children}</EuiText>
    </EuiFlexItem>
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
  onClone,
  onEnable,
  onDisable,
  onSnooze,
  onCancelSnooze,
  onDelete,
  isStateLoading = false,
  isSnoozeLoading = false,
}: ActionPolicyDetailsFlyoutProps) => {
  const settings = useService(CoreStart('settings'));
  const dateTimeFormat = settings.client.get<string>('dateFormat');

  const snoozedActive = isSnoozed(policy.snoozedUntil);
  const groupingMode = policy.groupingMode ?? 'per_episode';
  const throttleStrategy = policy.throttle?.strategy;
  const throttleInterval = policy.throttle?.interval;

  const handleEdit = () => {
    onClose();
    onEdit(policy.id);
  };

  const handleClone = () => {
    onClose();
    onClone(policy);
  };

  const handleDelete = () => {
    onClose();
    onDelete(policy);
  };

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
            <ActionPolicyStateBadge policy={policy} isLoading={isStateLoading} />
          </EuiFlexItem>
          {snoozedActive && policy.snoozedUntil && (
            <EuiFlexItem grow={false}>
              <EuiBadge color="accent" iconType="bellSlash">
                <FormattedMessage
                  id="xpack.alertingV2.actionPolicy.detailsFlyout.snoozedUntil"
                  defaultMessage="Snoozed until {date}"
                  values={{ date: formatSnoozeFullDate(policy.snoozedUntil) }}
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
          <EuiFlexGroup direction="column" gutterSize="m">
            <EuiFlexItem>
              <FieldRow
                label={
                  <FormattedMessage
                    id="xpack.alertingV2.actionPolicy.detailsFlyout.basicInfo.description"
                    defaultMessage="Description"
                  />
                }
              >
                {policy.description ? policy.description : renderEmDash()}
              </FieldRow>
            </EuiFlexItem>
            <EuiFlexItem>
              <FieldRow
                label={
                  <FormattedMessage
                    id="xpack.alertingV2.actionPolicy.detailsFlyout.basicInfo.tags"
                    defaultMessage="Tags"
                  />
                }
              >
                {policy.tags && policy.tags.length > 0 ? (
                  <EuiFlexGroup gutterSize="xs" wrap responsive={false}>
                    {policy.tags.map((tag) => (
                      <EuiFlexItem grow={false} key={tag}>
                        <EuiBadge color="hollow">{tag}</EuiBadge>
                      </EuiFlexItem>
                    ))}
                  </EuiFlexGroup>
                ) : (
                  renderEmDash()
                )}
              </FieldRow>
            </EuiFlexItem>
          </EuiFlexGroup>
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
          <FieldRow
            label={
              <FormattedMessage
                id="xpack.alertingV2.actionPolicy.detailsFlyout.matchConditions.matcher"
                defaultMessage="Matcher"
              />
            }
          >
            {policy.matcher ? (
              <EuiCode>{policy.matcher}</EuiCode>
            ) : (
              <EuiText size="s" color="subdued">
                <FormattedMessage
                  id="xpack.alertingV2.actionPolicy.detailsFlyout.matchConditions.matchesAll"
                  defaultMessage="Matches all alerts."
                />
              </EuiText>
            )}
          </FieldRow>
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
          <EuiFlexGroup direction="column" gutterSize="m">
            <EuiFlexItem>
              <FieldRow
                label={
                  <FormattedMessage
                    id="xpack.alertingV2.actionPolicy.detailsFlyout.dispatch.mode"
                    defaultMessage="Dispatch per"
                  />
                }
              >
                {getGroupingModeLabel(policy.groupingMode)}
              </FieldRow>
            </EuiFlexItem>
            {groupingMode === 'per_field' && policy.groupBy && policy.groupBy.length > 0 && (
              <EuiFlexItem>
                <FieldRow
                  label={
                    <FormattedMessage
                      id="xpack.alertingV2.actionPolicy.detailsFlyout.dispatch.groupBy"
                      defaultMessage="Group by"
                    />
                  }
                >
                  <EuiFlexGroup gutterSize="xs" wrap responsive={false}>
                    {policy.groupBy.map((field) => (
                      <EuiFlexItem grow={false} key={field}>
                        <EuiBadge color="hollow">{field}</EuiBadge>
                      </EuiFlexItem>
                    ))}
                  </EuiFlexGroup>
                </FieldRow>
              </EuiFlexItem>
            )}
            <EuiFlexItem>
              <FieldRow
                label={
                  <FormattedMessage
                    id="xpack.alertingV2.actionPolicy.detailsFlyout.dispatch.frequency"
                    defaultMessage="Frequency"
                  />
                }
              >
                {getThrottleStrategyLabel(throttleStrategy, groupingMode)}
                {throttleInterval && (
                  <>
                    {' '}
                    <EuiText size="xs" color="subdued">
                      <FormattedMessage
                        id="xpack.alertingV2.actionPolicy.detailsFlyout.dispatch.interval"
                        defaultMessage="Every {interval}"
                        values={{ interval: throttleInterval }}
                      />
                    </EuiText>
                  </>
                )}
              </FieldRow>
            </EuiFlexItem>
            <EuiFlexItem>
              <DispatchConfigSummary
                groupingMode={groupingMode}
                groupBy={policy.groupBy ?? []}
                throttleStrategy={throttleStrategy ?? 'on_status_change'}
                throttleInterval={throttleInterval ?? ''}
              />
            </EuiFlexItem>
          </EuiFlexGroup>
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
            renderEmDash()
          ) : (
            <EuiFlexGroup direction="column" gutterSize="s">
              {policy.destinations.map((destination, index) => (
                <EuiFlexItem key={`${destination.type}-${destination.id}-${index}`}>
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
          <EuiFlexGroup direction="column" gutterSize="m">
            <EuiFlexItem>
              <FieldRow
                label={
                  <FormattedMessage
                    id="xpack.alertingV2.actionPolicy.detailsFlyout.metadata.createdBy"
                    defaultMessage="Created by"
                  />
                }
              >
                {policy.createdByUsername ?? renderEmDash()}
              </FieldRow>
            </EuiFlexItem>
            <EuiFlexItem>
              <FieldRow
                label={
                  <FormattedMessage
                    id="xpack.alertingV2.actionPolicy.detailsFlyout.metadata.createdAt"
                    defaultMessage="Created at"
                  />
                }
              >
                {moment(policy.createdAt).format(dateTimeFormat)}
              </FieldRow>
            </EuiFlexItem>
            <EuiFlexItem>
              <FieldRow
                label={
                  <FormattedMessage
                    id="xpack.alertingV2.actionPolicy.detailsFlyout.metadata.updatedBy"
                    defaultMessage="Updated by"
                  />
                }
              >
                {policy.updatedByUsername ?? renderEmDash()}
              </FieldRow>
            </EuiFlexItem>
            <EuiFlexItem>
              <FieldRow
                label={
                  <FormattedMessage
                    id="xpack.alertingV2.actionPolicy.detailsFlyout.metadata.updatedAt"
                    defaultMessage="Updated at"
                  />
                }
              >
                {moment(policy.updatedAt).format(dateTimeFormat)}
              </FieldRow>
            </EuiFlexItem>
          </EuiFlexGroup>
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
            <EuiFlexGroup gutterSize="s" responsive={false} alignItems="center">
              {policy.enabled && (
                <EuiFlexItem grow={false}>
                  <ActionPolicySnoozePopover
                    policy={policy}
                    onSnooze={onSnooze}
                    onCancelSnooze={onCancelSnooze}
                    isLoading={isSnoozeLoading}
                  />
                </EuiFlexItem>
              )}
              <EuiFlexItem grow={false}>
                {policy.enabled ? (
                  <EuiButton
                    color="text"
                    iconType="stop"
                    isLoading={isStateLoading}
                    onClick={() => onDisable(policy.id)}
                    data-test-subj="detailsFlyoutDisableButton"
                  >
                    <FormattedMessage
                      id="xpack.alertingV2.actionPolicy.detailsFlyout.disable"
                      defaultMessage="Disable"
                    />
                  </EuiButton>
                ) : (
                  <EuiButton
                    color="text"
                    iconType="play"
                    isLoading={isStateLoading}
                    onClick={() => onEnable(policy.id)}
                    data-test-subj="detailsFlyoutEnableButton"
                  >
                    <FormattedMessage
                      id="xpack.alertingV2.actionPolicy.detailsFlyout.enable"
                      defaultMessage="Enable"
                    />
                  </EuiButton>
                )}
              </EuiFlexItem>
              <EuiFlexItem grow={false}>
                <EuiButton
                  color="text"
                  iconType="copy"
                  onClick={handleClone}
                  data-test-subj="detailsFlyoutCloneButton"
                >
                  <FormattedMessage
                    id="xpack.alertingV2.actionPolicy.detailsFlyout.clone"
                    defaultMessage="Clone"
                  />
                </EuiButton>
              </EuiFlexItem>
              <EuiFlexItem grow={false}>
                <EuiButton
                  color="danger"
                  iconType="trash"
                  onClick={handleDelete}
                  data-test-subj="detailsFlyoutDeleteButton"
                >
                  <FormattedMessage
                    id="xpack.alertingV2.actionPolicy.detailsFlyout.delete"
                    defaultMessage="Delete"
                  />
                </EuiButton>
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
          </EuiFlexItem>
        </EuiFlexGroup>
      </EuiFlyoutFooter>
    </EuiFlyout>
  );
};
