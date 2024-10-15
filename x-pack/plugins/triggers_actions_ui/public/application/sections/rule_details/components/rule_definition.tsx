/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */
import React, { useState, useEffect, useMemo } from 'react';
import {
  EuiText,
  EuiButtonEmpty,
  EuiFlexGroup,
  EuiFlexItem,
  EuiPanel,
  EuiTitle,
  EuiSpacer,
  EuiLoadingSpinner,
  EuiDescriptionList,
} from '@elastic/eui';
import { AlertConsumers, getEditRuleRoute, getRuleDetailsRoute } from '@kbn/rule-data-utils';
import { i18n } from '@kbn/i18n';
import { formatDuration } from '@kbn/alerting-plugin/common';
import { useLoadRuleTypesQuery } from '../../../hooks/use_load_rule_types_query';
import { RuleDefinitionProps } from '../../../../types';
import { RuleType } from '../../../..';
import { useKibana } from '../../../../common/lib/kibana';
import { getIsExperimentalFeatureEnabled } from '../../../../common/get_experimental_features';
import {
  hasAllPrivilege,
  hasExecuteActionsCapability,
  hasShowActionsCapability,
} from '../../../lib/capabilities';
import { RuleActions } from './rule_actions';
import { RuleEdit } from '../../rule_form';

export const RuleDefinition: React.FunctionComponent<RuleDefinitionProps> = ({
  rule,
  actionTypeRegistry,
  ruleTypeRegistry,
  onEditRule,
  hideEditButton = false,
  filteredRuleTypes = [],
  useNewRuleForm = false,
}) => {
  const {
    application: { capabilities, navigateToApp },
  } = useKibana().services;

  const isUsingRuleCreateFlyout = getIsExperimentalFeatureEnabled('isUsingRuleCreateFlyout');

  const [editFlyoutVisible, setEditFlyoutVisible] = useState<boolean>(false);
  const [ruleType, setRuleType] = useState<RuleType>();
  const {
    ruleTypesState: { data: ruleTypeIndex, isLoading: ruleTypesIsLoading },
  } = useLoadRuleTypesQuery({
    filteredRuleTypes,
  });
  const ruleTypes = useMemo(() => [...ruleTypeIndex.values()], [ruleTypeIndex]);

  const getRuleType = useMemo(() => {
    if (ruleTypes.length && rule) {
      return ruleTypes.find((type) => type.id === rule.ruleTypeId);
    }
  }, [rule, ruleTypes]);

  useEffect(() => {
    setRuleType(getRuleType);
  }, [getRuleType]);

  const getRuleConditionsWording = () => {
    const numberOfConditions = rule?.params.criteria ? (rule?.params.criteria as any[]).length : 0;
    return i18n.translate('xpack.triggersActionsUI.ruleDetails.conditions', {
      defaultMessage: '{numberOfConditions, plural, one {# condition} other {# conditions}}',
      values: { numberOfConditions },
    });
  };
  const canReadActions = hasShowActionsCapability(capabilities);
  const canExecuteActions = hasExecuteActionsCapability(capabilities);
  const canSaveRule =
    rule &&
    hasAllPrivilege(rule.consumer, ruleType) &&
    // if the rule has actions, can the user save the rule's action params
    (canExecuteActions || (!canExecuteActions && rule.actions.length === 0));
  const hasEditButton = useMemo(() => {
    if (hideEditButton) {
      return false;
    }
    // can the user save the rule
    return (
      canSaveRule &&
      // is this rule type editable from within Rules Management
      (ruleTypeRegistry.has(rule.ruleTypeId)
        ? !ruleTypeRegistry.get(rule.ruleTypeId).requiresAppContext
        : false)
    );
  }, [hideEditButton, canSaveRule, ruleTypeRegistry, rule]);

  const ruleDescription = useMemo(() => {
    if (ruleTypeRegistry.has(rule.ruleTypeId)) {
      return ruleTypeRegistry.get(rule.ruleTypeId).description;
    }
    // TODO: Replace this generic description with proper SIEM rule descriptions
    if (rule.consumer === AlertConsumers.SIEM) {
      return i18n.translate('xpack.triggersActionsUI.ruleDetails.securityDetectionRule', {
        defaultMessage: 'Security detection rule',
      });
    }
    return '';
  }, [rule, ruleTypeRegistry]);

  const onEditRuleClick = () => {
    if (!isUsingRuleCreateFlyout && useNewRuleForm) {
      navigateToApp('management', {
        path: `insightsAndAlerting/triggersActions/${getEditRuleRoute(rule.id)}`,
        state: {
          returnApp: 'management',
          returnPath: `insightsAndAlerting/triggersActions/${getRuleDetailsRoute(rule.id)}`,
        },
      });
    } else {
      setEditFlyoutVisible(true);
    }
  };

  const ruleDefinitionList = [
    {
      title: i18n.translate('xpack.triggersActionsUI.ruleDetails.ruleType', {
        defaultMessage: 'Rule type',
      }),
      description: ruleTypesIsLoading ? (
        <EuiFlexItem>
          <EuiLoadingSpinner data-test-subj="ruleSummaryRuleTypeLoadingSpinner" />
        </EuiFlexItem>
      ) : (
        <ItemValueRuleSummary
          data-test-subj="ruleSummaryRuleType"
          itemValue={ruleTypeIndex.get(rule.ruleTypeId)?.name || rule.ruleTypeId}
        />
      ),
    },
    {
      title: i18n.translate('xpack.triggersActionsUI.ruleDetails.description', {
        defaultMessage: 'Description',
      }),
      description: (
        <ItemValueRuleSummary
          data-test-subj="ruleSummaryRuleDescription"
          itemValue={ruleDescription}
        />
      ),
    },
    {
      title: i18n.translate('xpack.triggersActionsUI.ruleDetails.runsEvery', {
        defaultMessage: 'Runs every',
      }),
      description: (
        <ItemValueRuleSummary
          data-test-subj="ruleSummaryRuleInterval"
          itemValue={formatDuration(rule.schedule.interval)}
        />
      ),
    },
    {
      title: i18n.translate('xpack.triggersActionsUI.ruleDetails.conditionsTitle', {
        defaultMessage: 'Conditions',
      }),
      description: (
        <EuiFlexGroup
          data-test-subj="ruleSummaryRuleConditions"
          alignItems="center"
          gutterSize="none"
        >
          <EuiFlexItem grow={false}>
            {hasEditButton ? (
              <EuiButtonEmpty onClick={onEditRuleClick} flush="left">
                <EuiText size="s">{getRuleConditionsWording()}</EuiText>
              </EuiButtonEmpty>
            ) : (
              <EuiText size="s">{getRuleConditionsWording()}</EuiText>
            )}
          </EuiFlexItem>
        </EuiFlexGroup>
      ),
    },
    {
      title: i18n.translate('xpack.triggersActionsUI.ruleDetails.actions', {
        defaultMessage: 'Actions',
      }),
      description: canReadActions ? (
        <RuleActions
          ruleActions={rule.actions}
          actionTypeRegistry={actionTypeRegistry}
          legacyNotifyWhen={rule.notifyWhen}
        />
      ) : (
        <EuiFlexItem>
          <EuiText size="s">
            {i18n.translate('xpack.triggersActionsUI.ruleDetails.cannotReadActions', {
              defaultMessage: 'Connector feature privileges are required to view actions',
            })}
          </EuiText>
        </EuiFlexItem>
      ),
    },
  ];

  return (
    <EuiFlexItem data-test-subj="ruleSummaryRuleDefinition" grow={3}>
      <EuiPanel color="subdued" hasBorder={false} paddingSize="m">
        <EuiFlexGroup justifyContent="spaceBetween">
          <EuiTitle size="s">
            <EuiFlexItem grow={false}>
              {i18n.translate('xpack.triggersActionsUI.ruleDetails.definition', {
                defaultMessage: 'Definition',
              })}
            </EuiFlexItem>
          </EuiTitle>
          {ruleTypesIsLoading ? (
            <EuiFlexItem grow={false}>
              <EuiLoadingSpinner data-test-subj="ruleDetailsEditButtonLoadingSpinner" />
            </EuiFlexItem>
          ) : (
            hasEditButton && (
              <EuiFlexItem grow={false}>
                <EuiButtonEmpty
                  data-test-subj="ruleDetailsEditButton"
                  iconType={'pencil'}
                  onClick={onEditRuleClick}
                />
              </EuiFlexItem>
            )
          )}
        </EuiFlexGroup>
        <EuiSpacer size="m" />
        <EuiDescriptionList compressed={true} type="column" listItems={ruleDefinitionList} />
      </EuiPanel>
      {editFlyoutVisible && (
        <RuleEdit
          onSave={() => {
            setEditFlyoutVisible(false);
            return onEditRule();
          }}
          initialRule={rule}
          onClose={() => setEditFlyoutVisible(false)}
          ruleTypeRegistry={ruleTypeRegistry}
          actionTypeRegistry={actionTypeRegistry}
        />
      )}
    </EuiFlexItem>
  );
};

export interface ItemValueRuleSummaryProps {
  itemValue: string;
  extraSpace?: boolean;
}

function ItemValueRuleSummary({
  itemValue,
  extraSpace = true,
  ...otherProps
}: ItemValueRuleSummaryProps) {
  return (
    <EuiFlexItem grow={extraSpace ? 3 : 1} {...otherProps}>
      <EuiText size="s">{itemValue}</EuiText>
    </EuiFlexItem>
  );
}

// eslint-disable-next-line import/no-default-export
export { RuleDefinition as default };
