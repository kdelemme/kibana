/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import {
  EuiBadge,
  EuiBasicTable,
  EuiButton,
  EuiButtonIcon,
  EuiCallOut,
  EuiCodeBlock,
  EuiContextMenu,
  EuiFlexGroup,
  EuiFlexItem,
  EuiPageHeader,
  EuiPopover,
  EuiSpacer,
  type CriteriaWithPagination,
  type EuiBasicTableColumn,
} from '@elastic/eui';
import type { NotificationPolicyResponse } from '@kbn/alerting-v2-schemas';
import { CoreStart, useService } from '@kbn/core-di-browser';
import { i18n } from '@kbn/i18n';
import { FormattedMessage } from '@kbn/i18n-react';
import React, { useState } from 'react';
import { DeleteNotificationPolicyConfirmModal } from '../../components/notification_policy/delete_confirmation_modal';
import { NotificationPolicyDestinationBadge } from '../../components/notification_policy/notification_policy_destination_badge';
import { NotificationPolicySnoozePopover } from '../../components/notification_policy/notification_policy_snooze_popover';
import { NotificationPolicyStateBadge } from '../../components/notification_policy/notification_policy_state_badge';
import { paths } from '../../constants';
import { useDeleteNotificationPolicy } from '../../hooks/use_delete_notification_policy';
import { useDisableNotificationPolicy } from '../../hooks/use_disable_notification_policy';
import { useEnableNotificationPolicy } from '../../hooks/use_enable_notification_policy';
import { useFetchNotificationPolicies } from '../../hooks/use_fetch_notification_policies';
import { useSnoozeNotificationPolicy } from '../../hooks/use_snooze_notification_policy';
import { useUnsnoozeNotificationPolicy } from '../../hooks/use_unsnooze_notification_policy';

const DEFAULT_PER_PAGE = 20;

const NotificationPolicyActionsCell = ({
  policy,
  onEdit,
  onDelete,
  onEnable,
  onDisable,
  isStateLoading,
}: {
  policy: NotificationPolicyResponse;
  onEdit: (id: string) => void;
  onDelete: (policy: NotificationPolicyResponse) => void;
  onEnable: (id: string) => void;
  onDisable: (id: string) => void;
  isStateLoading: boolean;
}) => {
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);

  const togglePopover = () => setIsPopoverOpen((prev) => !prev);
  const closePopover = () => setIsPopoverOpen(false);

  const panels = [
    {
      id: 0,
      items: [
        {
          name: i18n.translate('xpack.alertingV2.notificationPoliciesList.action.edit', {
            defaultMessage: 'Edit',
          }),
          icon: 'pencil',
          onClick: () => {
            closePopover();
            onEdit(policy.id);
          },
        },
        {
          name: policy.enabled
            ? i18n.translate('xpack.alertingV2.notificationPoliciesList.action.disable', {
                defaultMessage: 'Disable',
              })
            : i18n.translate('xpack.alertingV2.notificationPoliciesList.action.enable', {
                defaultMessage: 'Enable',
              }),
          icon: policy.enabled ? 'stop' : 'play',
          disabled: isStateLoading,
          onClick: () => {
            closePopover();
            if (policy.enabled) {
              onDisable(policy.id);
            } else {
              onEnable(policy.id);
            }
          },
        },
        {
          name: i18n.translate('xpack.alertingV2.notificationPoliciesList.action.delete', {
            defaultMessage: 'Delete',
          }),
          icon: 'trash',
          onClick: () => {
            closePopover();
            onDelete(policy);
          },
        },
      ],
    },
  ];

  return (
    <EuiFlexGroup gutterSize="xs" responsive={false} alignItems="center">
      <EuiFlexItem grow={false}>
        <EuiButtonIcon
          iconType="pencil"
          aria-label={i18n.translate(
            'xpack.alertingV2.notificationPoliciesList.action.edit.description',
            { defaultMessage: 'Edit this notification policy' }
          )}
          onClick={() => onEdit(policy.id)}
        />
      </EuiFlexItem>
      <EuiFlexItem grow={false}>
        <EuiButtonIcon
          iconType="trash"
          color="danger"
          aria-label={i18n.translate(
            'xpack.alertingV2.notificationPoliciesList.action.delete.description',
            { defaultMessage: 'Delete this notification policy' }
          )}
          onClick={() => onDelete(policy)}
        />
      </EuiFlexItem>
      <EuiFlexItem grow={false}>
        <EuiPopover
          button={
            <EuiButtonIcon
              iconType="boxesHorizontal"
              aria-label={i18n.translate('xpack.alertingV2.notificationPoliciesList.action.more', {
                defaultMessage: 'More actions',
              })}
              onClick={togglePopover}
            />
          }
          isOpen={isPopoverOpen}
          closePopover={closePopover}
          anchorPosition="downRight"
          panelPaddingSize="none"
        >
          <EuiContextMenu initialPanelId={0} panels={panels} size="s" />
        </EuiPopover>
      </EuiFlexItem>
    </EuiFlexGroup>
  );
};

export const ListNotificationPoliciesPage = () => {
  const [page, setPage] = useState(0);
  const [perPage, setPerPage] = useState(DEFAULT_PER_PAGE);
  const [policyToDelete, setPolicyToDelete] = useState<NotificationPolicyResponse | null>(null);

  const { navigateToUrl } = useService(CoreStart('application'));
  const { basePath } = useService(CoreStart('http'));

  const { mutate: deleteNotificationPolicy, isLoading: isDeleting } = useDeleteNotificationPolicy();
  const { mutate: enablePolicy, isLoading: isEnabling } = useEnableNotificationPolicy();
  const { mutate: disablePolicy, isLoading: isDisabling } = useDisableNotificationPolicy();
  const { mutate: snoozePolicy, isLoading: isSnoozing } = useSnoozeNotificationPolicy();
  const { mutate: unsnoozePolicy, isLoading: isUnsnoozing } = useUnsnoozeNotificationPolicy();

  const navigateToCreate = () => {
    navigateToUrl(basePath.prepend(paths.notificationPolicyCreate));
  };

  const navigateToEdit = (id: string) => {
    navigateToUrl(basePath.prepend(paths.notificationPolicyEdit(id)));
  };

  const { data, isLoading, isError, error } = useFetchNotificationPolicies({
    page: page + 1,
    perPage,
  });

  const items = data?.items ?? [];
  const total = data?.total ?? 0;

  const onTableChange = ({
    page: tablePage,
  }: CriteriaWithPagination<NotificationPolicyResponse>) => {
    setPage(tablePage.index);
    setPerPage(tablePage.size);
  };

  const pagination = {
    pageIndex: page,
    pageSize: perPage,
    totalItemCount: total,
    pageSizeOptions: [1, 10, 20, 50],
  };

  const columns: Array<EuiBasicTableColumn<NotificationPolicyResponse>> = [
    {
      field: 'name',
      name: (
        <FormattedMessage
          id="xpack.alertingV2.notificationPoliciesList.column.name"
          defaultMessage="Name"
        />
      ),
    },
    {
      field: 'enabled',
      name: (
        <FormattedMessage
          id="xpack.alertingV2.notificationPoliciesList.column.state"
          defaultMessage="State"
        />
      ),
      render: (_enabled: boolean, policy: NotificationPolicyResponse) => (
        <NotificationPolicyStateBadge
          policy={policy}
          onEnable={(id) => enablePolicy(id)}
          onDisable={(id) => disablePolicy(id)}
          isLoading={isEnabling || isDisabling}
        />
      ),
    },
    {
      field: 'snoozedUntil',
      name: (
        <FormattedMessage
          id="xpack.alertingV2.notificationPoliciesList.column.notify"
          defaultMessage="Notify"
        />
      ),
      render: (_snoozedUntil: string | undefined, policy: NotificationPolicyResponse) => {
        if (!policy.enabled) {
          return null;
        }
        return (
          <NotificationPolicySnoozePopover
            policy={policy}
            onSnooze={(id, until) => snoozePolicy({ id, snoozedUntil: until })}
            onCancelSnooze={(id) => unsnoozePolicy(id)}
            isLoading={isSnoozing || isUnsnoozing}
          />
        );
      },
    },
    {
      field: 'destinations',
      name: (
        <FormattedMessage
          id="xpack.alertingV2.notificationPoliciesList.column.destinations"
          defaultMessage="Destinations"
        />
      ),
      render: (destinations: NotificationPolicyResponse['destinations']) => (
        <EuiFlexGroup responsive={false} gutterSize="s" wrap>
          {destinations?.map((destination) => (
            <EuiFlexItem key={destination.id} grow={false}>
              <NotificationPolicyDestinationBadge destination={destination} />
            </EuiFlexItem>
          ))}
          {destinations?.length === 0 ? '-' : null}
        </EuiFlexGroup>
      ),
    },
    {
      field: 'matcher',
      name: (
        <FormattedMessage
          id="xpack.alertingV2.notificationPoliciesList.column.matcher"
          defaultMessage="Matcher"
        />
      ),
      render: (matcher: NotificationPolicyResponse['matcher']) =>
        matcher ? (
          <EuiCodeBlock paddingSize="s" fontSize="s">
            {matcher}
          </EuiCodeBlock>
        ) : (
          '-'
        ),
    },
    {
      field: 'group_by',
      name: (
        <FormattedMessage
          id="xpack.alertingV2.notificationPoliciesList.column.groupBy"
          defaultMessage="Group by"
        />
      ),
      render: (groupBy: string[]) => (
        <EuiFlexGroup responsive={false} gutterSize="s" wrap>
          {groupBy?.map((group) => (
            <EuiFlexItem key={group} grow={false}>
              <EuiBadge color="hollow">{group}</EuiBadge>
            </EuiFlexItem>
          ))}
          {groupBy?.length === 0 ? '-' : null}
        </EuiFlexGroup>
      ),
    },
    {
      field: 'updatedAt',
      name: (
        <FormattedMessage
          id="xpack.alertingV2.notificationPoliciesList.column.updatedAt"
          defaultMessage="Last update"
        />
      ),
      render: (updatedAt: string) => new Date(updatedAt).toLocaleString(),
    },
    {
      name: i18n.translate('xpack.alertingV2.notificationPoliciesList.column.actions', {
        defaultMessage: 'Actions',
      }),
      render: (policy: NotificationPolicyResponse) => (
        <NotificationPolicyActionsCell
          policy={policy}
          onEdit={navigateToEdit}
          onDelete={setPolicyToDelete}
          onEnable={(id) => enablePolicy(id)}
          onDisable={(id) => disablePolicy(id)}
          isStateLoading={isEnabling || isDisabling}
        />
      ),
    },
  ];

  const errorMessage = isError && error ? error.message : null;

  return (
    <>
      <EuiPageHeader
        pageTitle={
          <FormattedMessage
            id="xpack.alertingV2.notificationPoliciesList.pageTitle"
            defaultMessage="Notification Policies"
          />
        }
        rightSideItems={[
          <EuiButton key="create-policy" onClick={navigateToCreate}>
            <FormattedMessage
              id="xpack.alertingV2.notificationPoliciesList.createPolicyButton"
              defaultMessage="Create policy"
            />
          </EuiButton>,
        ]}
      />
      <EuiSpacer size="m" />
      {errorMessage ? (
        <>
          <EuiCallOut
            announceOnMount
            title={
              <FormattedMessage
                id="xpack.alertingV2.notificationPoliciesList.loadErrorTitle"
                defaultMessage="Failed to load notification policies"
              />
            }
            color="danger"
            iconType="error"
          >
            {errorMessage}
          </EuiCallOut>
          <EuiSpacer />
        </>
      ) : null}
      <EuiBasicTable
        items={items}
        columns={columns}
        responsiveBreakpoint={false}
        loading={isLoading}
        pagination={pagination}
        onChange={onTableChange}
        tableCaption={i18n.translate('xpack.alertingV2.notificationPoliciesList.tableCaption', {
          defaultMessage: 'Notification Policies',
        })}
      />
      {policyToDelete && (
        <DeleteNotificationPolicyConfirmModal
          policyName={policyToDelete.name}
          onCancel={() => setPolicyToDelete(null)}
          onConfirm={() => {
            deleteNotificationPolicy(policyToDelete.id, {
              onSuccess: () => setPolicyToDelete(null),
            });
          }}
          isLoading={isDeleting}
        />
      )}
    </>
  );
};
