/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import {
  EuiButton,
  EuiButtonEmpty,
  EuiButtonIcon,
  EuiFieldNumber,
  EuiFlexGroup,
  EuiFlexItem,
  EuiHorizontalRule,
  EuiLink,
  EuiPopover,
  EuiSelect,
  EuiSpacer,
  EuiText,
  EuiTitle,
  EuiToolTip,
} from '@elastic/eui';
import type { NotificationPolicyResponse } from '@kbn/alerting-v2-schemas';
import { i18n } from '@kbn/i18n';
import React, { useState } from 'react';

type DurationUnit = 'm' | 'h' | 'd';

const computeSnoozedUntil = (value: number, unit: DurationUnit): string => {
  const ms: Record<DurationUnit, number> = { m: 60_000, h: 3_600_000, d: 86_400_000 };
  return new Date(Date.now() + value * ms[unit]).toISOString();
};

const UNIT_OPTIONS: Array<{ value: DurationUnit; text: string }> = [
  {
    value: 'm',
    text: i18n.translate('xpack.alertingV2.notificationPolicy.snooze.minutes', {
      defaultMessage: 'Minutes',
    }),
  },
  {
    value: 'h',
    text: i18n.translate('xpack.alertingV2.notificationPolicy.snooze.hours', {
      defaultMessage: 'Hours',
    }),
  },
  {
    value: 'd',
    text: i18n.translate('xpack.alertingV2.notificationPolicy.snooze.days', {
      defaultMessage: 'Days',
    }),
  },
];

const COMMON_SNOOZE_TIMES: Array<{ label: string; value: number; unit: DurationUnit }> = [
  {
    label: i18n.translate('xpack.alertingV2.notificationPolicy.snooze.preset.1h', {
      defaultMessage: '1 hour',
    }),
    value: 1,
    unit: 'h',
  },
  {
    label: i18n.translate('xpack.alertingV2.notificationPolicy.snooze.preset.3h', {
      defaultMessage: '3 hours',
    }),
    value: 3,
    unit: 'h',
  },
  {
    label: i18n.translate('xpack.alertingV2.notificationPolicy.snooze.preset.8h', {
      defaultMessage: '8 hours',
    }),
    value: 8,
    unit: 'h',
  },
  {
    label: i18n.translate('xpack.alertingV2.notificationPolicy.snooze.preset.1d', {
      defaultMessage: '1 day',
    }),
    value: 1,
    unit: 'd',
  },
];

const formatSnoozeDate = (dateStr: string): string => {
  const date = new Date(dateStr);
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
  });
};

const formatSnoozeFullDate = (dateStr: string): string => {
  const date = new Date(dateStr);
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
};

interface NotificationPolicySnoozePopoverProps {
  policy: NotificationPolicyResponse;
  onSnooze: (id: string, snoozedUntil: string) => void;
  onCancelSnooze: (id: string) => void;
  isLoading: boolean;
}

export const NotificationPolicySnoozePopover = ({
  policy,
  onSnooze,
  onCancelSnooze,
  isLoading,
}: NotificationPolicySnoozePopoverProps) => {
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  const [durationValue, setDurationValue] = useState(1);
  const [durationUnit, setDurationUnit] = useState<DurationUnit>('h');

  const isSnoozed =
    policy.snoozedUntil != null && new Date(policy.snoozedUntil).getTime() > Date.now();

  const togglePopover = () => setIsPopoverOpen((prev) => !prev);
  const closePopover = () => setIsPopoverOpen(false);

  const applySnooze = (value: number, unit: DurationUnit) => {
    onSnooze(policy.id, computeSnoozedUntil(value, unit));
    closePopover();
  };

  const triggerButton = isSnoozed ? (
    <EuiToolTip
      content={i18n.translate('xpack.alertingV2.notificationPolicy.snooze.snoozedUntilTooltip', {
        defaultMessage: 'Snoozed until {date}',
        values: { date: formatSnoozeFullDate(policy.snoozedUntil!) },
      })}
    >
      <EuiButton
        iconType="bellSlash"
        color="accent"
        size="s"
        onClick={togglePopover}
        isLoading={isLoading}
      >
        {formatSnoozeDate(policy.snoozedUntil!)}
      </EuiButton>
    </EuiToolTip>
  ) : (
    <EuiButtonIcon
      iconType="bell"
      aria-label={i18n.translate('xpack.alertingV2.notificationPolicy.snooze.ariaLabel', {
        defaultMessage: 'Snooze notification policy',
      })}
      onClick={togglePopover}
      isLoading={isLoading}
    />
  );

  return (
    <EuiPopover
      button={triggerButton}
      isOpen={isPopoverOpen}
      closePopover={closePopover}
      anchorPosition="downLeft"
      panelStyle={{ width: 320 }}
    >
      <EuiTitle size="xxxs">
        <h4>
          {i18n.translate('xpack.alertingV2.notificationPolicy.snooze.title', {
            defaultMessage: 'Snooze notifications',
          })}
        </h4>
      </EuiTitle>
      <EuiSpacer size="s" />
      <EuiFlexGroup gutterSize="s" responsive={false} alignItems="center">
        <EuiFlexItem grow={false} style={{ width: 80 }}>
          <EuiFieldNumber
            min={1}
            value={durationValue}
            onChange={(e) => setDurationValue(Math.max(1, parseInt(e.target.value, 10) || 1))}
            compressed
          />
        </EuiFlexItem>
        <EuiFlexItem grow={false} style={{ width: 120 }}>
          <EuiSelect
            options={UNIT_OPTIONS}
            value={durationUnit}
            onChange={(e) => setDurationUnit(e.target.value as DurationUnit)}
            compressed
            aria-label={i18n.translate(
              'xpack.alertingV2.notificationPolicy.snooze.unitSelectAriaLabel',
              { defaultMessage: 'Snooze duration unit' }
            )}
          />
        </EuiFlexItem>
        <EuiFlexItem grow={false}>
          <EuiButton size="s" onClick={() => applySnooze(durationValue, durationUnit)}>
            {i18n.translate('xpack.alertingV2.notificationPolicy.snooze.apply', {
              defaultMessage: 'Apply',
            })}
          </EuiButton>
        </EuiFlexItem>
      </EuiFlexGroup>

      <EuiHorizontalRule margin="s" />

      <EuiText size="xs" color="subdued">
        {i18n.translate('xpack.alertingV2.notificationPolicy.snooze.commonlyUsed', {
          defaultMessage: 'Commonly used',
        })}
      </EuiText>
      <EuiSpacer size="xs" />
      <EuiFlexGroup gutterSize="s" responsive={false} wrap>
        {COMMON_SNOOZE_TIMES.map((preset) => (
          <EuiFlexItem key={preset.label} grow={false}>
            <EuiLink onClick={() => applySnooze(preset.value, preset.unit)}>{preset.label}</EuiLink>
          </EuiFlexItem>
        ))}
      </EuiFlexGroup>

      {isSnoozed && (
        <>
          <EuiHorizontalRule margin="s" />
          <EuiButtonEmpty
            size="s"
            color="danger"
            onClick={() => {
              onCancelSnooze(policy.id);
              closePopover();
            }}
          >
            {i18n.translate('xpack.alertingV2.notificationPolicy.snooze.cancel', {
              defaultMessage: 'Cancel snooze',
            })}
          </EuiButtonEmpty>
        </>
      )}
    </EuiPopover>
  );
};
