/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import React, { memo, useState, useEffect, useMemo } from 'react';
import { i18n } from '@kbn/i18n';
import { FormattedMessage } from '@kbn/i18n-react';
import {
  EuiFormRow,
  EuiFieldText,
  EuiButtonEmpty,
  EuiText,
  EuiComboBox,
  EuiDescribedFormGroup,
  EuiFlexGroup,
  EuiFlexItem,
  EuiLink,
  EuiCallOut,
  EuiSpacer,
  EuiSelect,
  type EuiComboBoxOptionOption,
  EuiIconTip,
} from '@elastic/eui';

import styled from 'styled-components';

import type { PackageInfo, NewPackagePolicy, RegistryVarsEntry } from '../../../../../types';
import { Loading } from '../../../../../components';
import { useGetEpmDatastreams, useStartServices } from '../../../../../hooks';

import { isAdvancedVar } from '../../services';
import type { PackagePolicyValidationResults } from '../../services';

import { PackagePolicyInputVarField } from './components';
import { useOutputs } from './components/hooks';

// on smaller screens, fields should be displayed in one column
const FormGroupResponsiveFields = styled(EuiDescribedFormGroup)`
  @media (max-width: 767px) {
    [class*='euiFlexGroup-responsive'] {
      align-items: flex-start;
    }
  }
`;

export const StepDefinePackagePolicy: React.FunctionComponent<{
  namespacePlaceholder?: string;
  packageInfo: PackageInfo;
  packagePolicy: NewPackagePolicy;
  updatePackagePolicy: (fields: Partial<NewPackagePolicy>) => void;
  validationResults: PackagePolicyValidationResults | undefined;
  submitAttempted: boolean;
  isEditPage?: boolean;
  noAdvancedToggle?: boolean;
}> = memo(
  ({
    namespacePlaceholder,
    packageInfo,
    packagePolicy,
    updatePackagePolicy,
    validationResults,
    submitAttempted,
    noAdvancedToggle = false,
    isEditPage = false,
  }) => {
    const { docLinks } = useStartServices();

    // Form show/hide states
    const [isShowingAdvanced, setIsShowingAdvanced] = useState<boolean>(noAdvancedToggle);

    // Package-level vars
    const requiredVars: RegistryVarsEntry[] = [];
    const advancedVars: RegistryVarsEntry[] = [];

    if (packageInfo.vars) {
      packageInfo.vars.forEach((varDef) => {
        if (isAdvancedVar(varDef)) {
          advancedVars.push(varDef);
        } else {
          requiredVars.push(varDef);
        }
      });
    }

    // Outputs
    const {
      isLoading: isOutputsLoading,
      canUseOutputPerIntegration,
      allowedOutputs,
    } = useOutputs(packagePolicy, packageInfo.name);

    const { data: epmDatastreamsRes } = useGetEpmDatastreams();

    const datastreamsOptions = useMemo<Array<EuiComboBoxOptionOption<string>>>(
      () =>
        epmDatastreamsRes?.items?.map((item) => ({
          label: item.name,
          value: item.name,
        })) ?? [],
      [epmDatastreamsRes]
    );

    const selectedDatastreamOptions = useMemo<EuiComboBoxOptionOption[]>(
      () =>
        packagePolicy?.additional_datastreams_permissions?.map((item) => ({
          label: item,
          value: item,
        })) ?? [],
      [packagePolicy?.additional_datastreams_permissions]
    );

    // Reset output if switching to agentless and the current
    // selected output is not allowed
    useEffect(() => {
      if (packagePolicy.supports_agentless && packagePolicy.output_id) {
        const currentOutput = allowedOutputs.find((o) => o.id === packagePolicy.output_id);
        if (!currentOutput) {
          updatePackagePolicy({
            output_id: null,
          });
        }
      }
    }, [
      packagePolicy.supports_agentless,
      packagePolicy.output_id,
      allowedOutputs,
      updatePackagePolicy,
    ]);

    // Managed policy
    const isManaged = packagePolicy.is_managed;

    return validationResults ? (
      <>
        {isManaged && (
          <>
            <EuiCallOut
              title={
                <FormattedMessage
                  id="xpack.fleet.createPackagePolicy.stepConfigure.managedReadonly"
                  defaultMessage="This is a managed package policy. You cannot modify it here."
                />
              }
              iconType="lock"
            />
            <EuiSpacer size="m" />
          </>
        )}
        <FormGroupResponsiveFields
          fullWidth
          title={
            <h3>
              <FormattedMessage
                id="xpack.fleet.createPackagePolicy.stepConfigure.integrationSettingsSectionTitle"
                defaultMessage="Integration settings"
              />
            </h3>
          }
          description={
            <FormattedMessage
              id="xpack.fleet.createPackagePolicy.stepConfigure.integrationSettingsSectionDescription"
              defaultMessage="Choose a name and description to help identify how this integration will be used."
            />
          }
        >
          <EuiFlexGroup direction="column" gutterSize="m">
            {/* Name */}
            <EuiFlexItem>
              <EuiFormRow
                fullWidth
                isInvalid={!!validationResults.name}
                error={validationResults.name}
                label={
                  <FormattedMessage
                    id="xpack.fleet.createPackagePolicy.stepConfigure.packagePolicyNameInputLabel"
                    defaultMessage="Integration name"
                  />
                }
              >
                <EuiFieldText
                  fullWidth
                  readOnly={isManaged}
                  value={packagePolicy.name}
                  onChange={(e) =>
                    updatePackagePolicy({
                      name: e.target.value,
                    })
                  }
                  data-test-subj="packagePolicyNameInput"
                />
              </EuiFormRow>
            </EuiFlexItem>

            {/* Description */}
            <EuiFlexItem>
              <EuiFormRow
                fullWidth
                label={
                  <FormattedMessage
                    id="xpack.fleet.createPackagePolicy.stepConfigure.packagePolicyDescriptionInputLabel"
                    defaultMessage="Description"
                  />
                }
                labelAppend={
                  <EuiText size="xs" color="subdued">
                    <FormattedMessage
                      id="xpack.fleet.createPackagePolicy.stepConfigure.inputVarFieldOptionalLabel"
                      defaultMessage="Optional"
                    />
                  </EuiText>
                }
                isInvalid={!!validationResults.description}
                error={validationResults.description}
              >
                <EuiFieldText
                  fullWidth
                  readOnly={isManaged}
                  value={packagePolicy.description}
                  onChange={(e) =>
                    updatePackagePolicy({
                      description: e.target.value,
                    })
                  }
                  data-test-subj="packagePolicyDescriptionInput"
                />
              </EuiFormRow>
            </EuiFlexItem>

            {/* Required vars */}
            {requiredVars.map((varDef) => {
              const { name: varName, type: varType } = varDef;
              if (!packagePolicy.vars || !packagePolicy.vars[varName]) return null;
              const value = packagePolicy.vars[varName].value;

              return (
                <EuiFlexItem key={varName}>
                  <PackagePolicyInputVarField
                    varDef={varDef}
                    value={value}
                    onChange={(newValue: any) => {
                      updatePackagePolicy({
                        vars: {
                          ...packagePolicy.vars,
                          [varName]: {
                            type: varType,
                            value: newValue,
                          },
                        },
                      });
                    }}
                    errors={validationResults?.vars?.[varName] ?? []}
                    forceShowErrors={submitAttempted}
                    isEditPage={isEditPage}
                  />
                </EuiFlexItem>
              );
            })}

            {/* Advanced options toggle */}
            {!noAdvancedToggle && !isManaged && (
              <EuiFlexItem>
                <EuiFlexGroup justifyContent="spaceBetween" alignItems="center">
                  <EuiFlexItem grow={false}>
                    <EuiButtonEmpty
                      size="xs"
                      iconType={isShowingAdvanced ? 'arrowDown' : 'arrowRight'}
                      onClick={() => setIsShowingAdvanced(!isShowingAdvanced)}
                      flush="left"
                    >
                      <FormattedMessage
                        id="xpack.fleet.createPackagePolicy.stepConfigure.advancedOptionsToggleLinkText"
                        defaultMessage="Advanced options"
                      />
                    </EuiButtonEmpty>
                  </EuiFlexItem>
                  {!isShowingAdvanced && !!validationResults.namespace ? (
                    <EuiFlexItem grow={false}>
                      <EuiText color="danger" size="s">
                        <FormattedMessage
                          id="xpack.fleet.createPackagePolicy.stepConfigure.errorCountText"
                          defaultMessage="{count, plural, one {# error} other {# errors}}"
                          values={{ count: 1 }}
                        />
                      </EuiText>
                    </EuiFlexItem>
                  ) : null}
                </EuiFlexGroup>
              </EuiFlexItem>
            )}

            {/* Advanced options content */}
            {isShowingAdvanced ? (
              <EuiFlexItem>
                <EuiFlexGroup direction="column" gutterSize="m">
                  {/* Namespace  */}
                  <EuiFlexItem>
                    <EuiFormRow
                      isInvalid={!!validationResults.namespace}
                      error={validationResults.namespace}
                      label={
                        <FormattedMessage
                          id="xpack.fleet.createPackagePolicy.stepConfigure.packagePolicyNamespaceInputLabel"
                          defaultMessage="Namespace"
                        />
                      }
                      helpText={
                        isEditPage && packageInfo.type === 'input' ? (
                          <FormattedMessage
                            id="xpack.fleet.createPackagePolicy.stepConfigure.packagePolicyInputOnlyEditNamespaceHelpLabel"
                            defaultMessage="The namespace cannot be changed for this integration. Create a new integration policy to use a different namespace."
                          />
                        ) : (
                          <FormattedMessage
                            id="xpack.fleet.createPackagePolicy.stepConfigure.packagePolicyNamespaceHelpLabel"
                            defaultMessage="Change the default namespace inherited from the parent agent policy. This setting changes the name of the integration's data stream. {learnMore}."
                            values={{
                              learnMore: (
                                <EuiLink
                                  href={docLinks.links.fleet.datastreamsNamingScheme}
                                  target="_blank"
                                >
                                  {i18n.translate(
                                    'xpack.fleet.createPackagePolicy.stepConfigure.packagePolicyNamespaceHelpLearnMoreLabel',
                                    { defaultMessage: 'Learn more' }
                                  )}
                                </EuiLink>
                              ),
                            }}
                          />
                        )
                      }
                    >
                      <EuiComboBox
                        data-test-subj="packagePolicyNamespaceInput"
                        noSuggestions
                        placeholder={namespacePlaceholder}
                        isDisabled={isEditPage && packageInfo.type === 'input'}
                        singleSelection={true}
                        selectedOptions={
                          packagePolicy.namespace ? [{ label: packagePolicy.namespace }] : []
                        }
                        onCreateOption={(newNamespace: string) => {
                          updatePackagePolicy({
                            namespace: newNamespace,
                          });
                        }}
                        onChange={(newNamespaces: Array<{ label: string }>) => {
                          updatePackagePolicy({
                            namespace: newNamespaces.length ? newNamespaces[0].label : '',
                          });
                        }}
                      />
                    </EuiFormRow>
                  </EuiFlexItem>

                  {/* Output */}
                  {canUseOutputPerIntegration && (
                    <EuiFlexItem>
                      <EuiFormRow
                        label={
                          <FormattedMessage
                            id="xpack.fleet.createPackagePolicy.stepConfigure.packagePolicyOutputInputLabel"
                            defaultMessage="Output"
                          />
                        }
                        helpText={
                          <FormattedMessage
                            id="xpack.fleet.createPackagePolicy.stepConfigure.packagePolicyOutputHelpLabel"
                            defaultMessage="Change the default output inherited from the parent agent policy. This setting changes where the integration's data is sent."
                          />
                        }
                      >
                        <EuiSelect
                          data-test-subj="packagePolicyOutputInput"
                          isLoading={isOutputsLoading}
                          options={[
                            {
                              value: '',
                              text: '',
                            },
                            ...allowedOutputs.map((output) => ({
                              value: output.id,
                              text: output.name,
                            })),
                          ]}
                          value={packagePolicy.output_id || ''}
                          onChange={(e) => {
                            updatePackagePolicy({
                              output_id: e.target.value.trim() || null,
                            });
                          }}
                        />
                      </EuiFormRow>
                    </EuiFlexItem>
                  )}

                  {/* Data retention settings info */}
                  <EuiFlexItem>
                    <EuiFormRow
                      label={
                        <FormattedMessage
                          id="xpack.fleet.createPackagePolicy.stepConfigure.packagePolicyDataRetentionLabel"
                          defaultMessage="Data retention settings"
                        />
                      }
                      helpText={
                        <FormattedMessage
                          id="xpack.fleet.createPackagePolicy.stepConfigure.packagePolicyDataRetentionText"
                          defaultMessage="By default all logs and metrics data are stored on the hot tier. {learnMore} about changing the data retention policy for this integration."
                          values={{
                            learnMore: (
                              <EuiLink href={docLinks.links.fleet.datastreamsILM} target="_blank">
                                {i18n.translate(
                                  'xpack.fleet.createPackagePolicy.stepConfigure.packagePolicyDataRetentionLearnMoreLink',
                                  { defaultMessage: 'Learn more' }
                                )}
                              </EuiLink>
                            ),
                          }}
                        />
                      }
                    >
                      <div />
                    </EuiFormRow>
                  </EuiFlexItem>
                  <EuiFlexItem>
                    <EuiFormRow
                      isInvalid={validationResults?.additional_datastreams_permissions !== null}
                      error={validationResults?.additional_datastreams_permissions ?? []}
                      label={
                        <FormattedMessage
                          id="xpack.fleet.createPackagePolicy.stepConfigure.additionalPermissionsLabel"
                          defaultMessage="Add a reroute processor permission {tooltip}"
                          values={{
                            tooltip: (
                              <EuiIconTip
                                content={
                                  <FormattedMessage
                                    id="xpack.fleet.createPackagePolicy.stepConfigure.additionalPermissionsToolTip"
                                    defaultMessage="Use the reroute processor to redirect data flows to another target index or data stream."
                                  />
                                }
                                position="right"
                              />
                            ),
                          }}
                        />
                      }
                    >
                      <EuiComboBox
                        selectedOptions={selectedDatastreamOptions}
                        options={datastreamsOptions}
                        onChange={(val) => {
                          updatePackagePolicy({
                            additional_datastreams_permissions: val.map((v) => v.label),
                          });
                        }}
                        onCreateOption={(option) => {
                          const additionalPermissions =
                            packagePolicy.additional_datastreams_permissions ?? [];

                          updatePackagePolicy({
                            additional_datastreams_permissions: [...additionalPermissions, option],
                          });
                        }}
                        placeholder={i18n.translate(
                          'xpack.fleet.createPackagePolicy.stepConfigure.additionalPermissionsPlaceholder',
                          {
                            defaultMessage: 'Add a permission',
                          }
                        )}
                      />
                    </EuiFormRow>
                  </EuiFlexItem>
                  {/* Advanced vars */}
                  {advancedVars.map((varDef) => {
                    const { name: varName, type: varType } = varDef;
                    if (!packagePolicy.vars || !packagePolicy.vars[varName]) return null;
                    const value = packagePolicy.vars![varName].value;
                    return (
                      <EuiFlexItem key={varName}>
                        <PackagePolicyInputVarField
                          varDef={varDef}
                          value={value}
                          onChange={(newValue: any) => {
                            updatePackagePolicy({
                              vars: {
                                ...packagePolicy.vars,
                                [varName]: {
                                  type: varType,
                                  value: newValue,
                                },
                              },
                            });
                          }}
                          errors={validationResults?.vars?.[varName] ?? []}
                          forceShowErrors={submitAttempted}
                          isEditPage={isEditPage}
                        />
                      </EuiFlexItem>
                    );
                  })}
                </EuiFlexGroup>
              </EuiFlexItem>
            ) : null}
          </EuiFlexGroup>
        </FormGroupResponsiveFields>
      </>
    ) : (
      <Loading />
    );
  }
);
