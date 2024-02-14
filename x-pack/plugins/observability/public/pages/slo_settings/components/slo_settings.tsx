import {
  EuiButton,
  EuiCallOut,
  EuiFieldNumber,
  EuiFlexGroup,
  EuiFlexItem,
  EuiFormRow,
  EuiSwitch,
  EuiText,
  EuiTitle,
} from '@elastic/eui';
import { i18n } from '@kbn/i18n';
import { Space } from '@kbn/spaces-plugin/public';
import React, { useEffect, useState } from 'react';
import { Controller, FormProvider, useForm } from 'react-hook-form';
import { useFetchSloSettings } from '../../../hooks/slo/use_fetch_slo_settings';
import { useUpdateSloSettings } from '../../../hooks/slo/use_update_slo_settings';
import { useKibana } from '../../../utils/kibana_react';
import { SLO_SETTINGS_DEFAULT_VALUES } from '../constants';
import {
  transformFormValuesToUpdateSloSettingsParams,
  transformSloSettingsResponseToFormValues,
} from '../helpers/process_form_values';
import { SLOSettingsForm } from '../types';

export function SloSettings() {
  const { spaces } = useKibana().services;
  const [space, setSpace] = useState<Space>();

  const { data: settings, isLoading: isLoadingSettings } = useFetchSloSettings();
  const { mutateAsync: updateSloSettings, isLoading: isUpdating } = useUpdateSloSettings();

  useEffect(() => {
    if (spaces) {
      spaces.getActiveSpace().then((space) => setSpace(space));
    }
  }, [spaces]);

  const methods = useForm<SLOSettingsForm>({
    defaultValues: SLO_SETTINGS_DEFAULT_VALUES,
    values: transformSloSettingsResponseToFormValues(settings),
    mode: 'all',
  });
  const { getValues, getFieldState, control, trigger } = methods;

  const handleSubmit = async () => {
    const isValid = await trigger();
    if (!isValid) {
      return;
    }

    await updateSloSettings(transformFormValuesToUpdateSloSettingsParams(getValues()));
  };

  return (
    <FormProvider {...methods}>
      <div css={{ maxInlineSize: 600 }}>
        <EuiFlexGroup direction="column" gutterSize="l">
          <EuiFlexItem>
            <EuiTitle size="m">
              <h1>
                {i18n.translate('xpack.observability.slo.sloSettings.stale.title', {
                  defaultMessage: 'Stale SLOs',
                })}
              </h1>
            </EuiTitle>
          </EuiFlexItem>

          <EuiFlexItem>
            <EuiText grow={false}>
              <p>
                Some SLO instances can become stale when the underlying group does not exist or stop
                reporting data. Until the main SLO definition is deleted, these instances will exist
                and can cluster the SLO dashboard page. You can configure auto removal of stale
                instances for this current Kibana space, as well as configure the duration required
                for an instance to be considered stale.
              </p>
            </EuiText>
          </EuiFlexItem>
          <EuiFlexItem>
            <EuiCallOut
              title={i18n.translate('xpack.observability.slo.sloSettings.stale.enabledRowLabel', {
                defaultMessage: 'These settings only apply for the current space: {space}',
                values: { space: space?.name },
              })}
              iconType="spaces"
            />
          </EuiFlexItem>
          <EuiFlexItem>
            <EuiFormRow
              fullWidth
              isDisabled={isLoadingSettings}
              label={i18n.translate('xpack.observability.slo.sloSettings.stale.enabledRowLabel', {
                defaultMessage: 'Enable stale summary documents automatic removal',
              })}
            >
              <Controller
                name="stale.enabled"
                control={control}
                defaultValue={false}
                render={({ field: { ref, onChange, ...field } }) => (
                  <EuiSwitch
                    disabled={isLoadingSettings}
                    label={
                      field.value
                        ? i18n.translate('xpack.observability.slo.sloSettings.stale.enabledLabel', {
                            defaultMessage: 'Enabled',
                          })
                        : i18n.translate(
                            'xpack.observability.slo.sloSettings.stale.disabledLabel',
                            {
                              defaultMessage: 'Disabled',
                            }
                          )
                    }
                    checked={field.value}
                    onChange={(e) => onChange(e.target.checked)}
                  />
                )}
              />
            </EuiFormRow>
          </EuiFlexItem>
          <EuiFlexItem>
            <EuiFormRow
              isInvalid={getFieldState('stale.duration').invalid}
              label={i18n.translate('xpack.observability.slo.sloSettings.stale.durationRowLabel', {
                defaultMessage:
                  'Duration in minutes before a summary document is considered stale (minimum 60min)',
              })}
            >
              <Controller
                name="stale.duration"
                control={control}
                defaultValue={2880}
                rules={{
                  required: true,
                  min: 60,
                }}
                render={({ field: { ref, onChange, ...field }, fieldState }) => (
                  <EuiFieldNumber
                    {...field}
                    style={{ width: 100 }}
                    disabled={isLoadingSettings}
                    required
                    isInvalid={fieldState.invalid}
                    value={String(field.value)}
                    min={1}
                    step={1}
                    onChange={(event) => onChange(Number(event.target.value))}
                  />
                )}
              />
            </EuiFormRow>
          </EuiFlexItem>
          <EuiFlexGroup direction="row" gutterSize="s">
            <EuiButton color="primary" fill onClick={handleSubmit} disabled={isUpdating}>
              {i18n.translate('xpack.observability.slo.sloSettings.saveBtn', {
                defaultMessage: 'Save',
              })}
            </EuiButton>
          </EuiFlexGroup>
        </EuiFlexGroup>
      </div>
    </FormProvider>
  );
}
