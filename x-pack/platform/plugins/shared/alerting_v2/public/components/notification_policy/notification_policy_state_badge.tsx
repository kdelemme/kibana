/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { EuiBadge, EuiButtonEmpty, EuiPopover } from '@elastic/eui';
import type { NotificationPolicyResponse } from '@kbn/alerting-v2-schemas';
import { i18n } from '@kbn/i18n';
import React, { useState } from 'react';

interface NotificationPolicyStateBadgeProps {
  policy: NotificationPolicyResponse;
  onEnable: (id: string) => void;
  onDisable: (id: string) => void;
  isLoading: boolean;
}

export const NotificationPolicyStateBadge = ({
  policy,
  onEnable,
  onDisable,
  isLoading,
}: NotificationPolicyStateBadgeProps) => {
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);

  const togglePopover = () => setIsPopoverOpen((prev) => !prev);
  const closePopover = () => setIsPopoverOpen(false);

  const badge = policy.enabled ? (
    <EuiBadge
      color="success"
      onClick={togglePopover}
      onClickAriaLabel={i18n.translate(
        'xpack.alertingV2.notificationPolicy.stateBadge.enabledAriaLabel',
        { defaultMessage: 'Enabled. Click to change state.' }
      )}
    >
      {i18n.translate('xpack.alertingV2.notificationPolicy.stateBadge.enabled', {
        defaultMessage: 'Enabled',
      })}
    </EuiBadge>
  ) : (
    <EuiBadge
      color="default"
      onClick={togglePopover}
      onClickAriaLabel={i18n.translate(
        'xpack.alertingV2.notificationPolicy.stateBadge.disabledAriaLabel',
        { defaultMessage: 'Disabled. Click to change state.' }
      )}
    >
      {i18n.translate('xpack.alertingV2.notificationPolicy.stateBadge.disabled', {
        defaultMessage: 'Disabled',
      })}
    </EuiBadge>
  );

  return (
    <EuiPopover
      button={badge}
      isOpen={isPopoverOpen}
      closePopover={closePopover}
      anchorPosition="downLeft"
    >
      {policy.enabled ? (
        <EuiButtonEmpty
          size="s"
          color="text"
          isLoading={isLoading}
          onClick={() => {
            onDisable(policy.id);
            closePopover();
          }}
        >
          {i18n.translate('xpack.alertingV2.notificationPolicy.stateBadge.disableAction', {
            defaultMessage: 'Disable',
          })}
        </EuiButtonEmpty>
      ) : (
        <EuiButtonEmpty
          size="s"
          color="text"
          isLoading={isLoading}
          onClick={() => {
            onEnable(policy.id);
            closePopover();
          }}
        >
          {i18n.translate('xpack.alertingV2.notificationPolicy.stateBadge.enableAction', {
            defaultMessage: 'Enable',
          })}
        </EuiButtonEmpty>
      )}
    </EuiPopover>
  );
};
