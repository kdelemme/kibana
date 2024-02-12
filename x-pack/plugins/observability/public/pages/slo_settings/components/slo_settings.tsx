import {
  EuiButton,
  EuiCallOut,
  EuiFieldNumber,
  EuiFlexGroup,
  EuiFlexItem,
  EuiFormRow,
  EuiSwitch,
} from '@elastic/eui';
import { i18n } from '@kbn/i18n';
import { Space } from '@kbn/spaces-plugin/public';
import React, { useEffect, useState } from 'react';
import { Controller, FormProvider, useForm } from 'react-hook-form';
import { useKibana } from '../../../utils/kibana_react';
import { SLO_SETTINGS_DEFAULT_VALUES } from '../constants';
import { transformSloSettingsResponseToFormValues } from '../helpers/process_form_values';
import { SLOSettingsForm } from '../types';

export function SloSettings() {
  const {
    application: { navigateToUrl },
    http: { basePath },
    spaces,
  } = useKibana().services;

  const [space, setSpace] = useState<Space>();
  useEffect(() => {
    if (spaces) {
      spaces.getActiveSpace().then((space) => setSpace(space));
    }
  }, [spaces]);

  const methods = useForm<SLOSettingsForm>({
    defaultValues: SLO_SETTINGS_DEFAULT_VALUES,
    values: transformSloSettingsResponseToFormValues(undefined),
    mode: 'all',
  });
  const { getValues, getFieldState, control, trigger } = methods;

  const handleSubmit = async () => {
    const isValid = await trigger();
    if (!isValid) {
      console.log('not valid');
      return;
    }

    const values = getValues();
    console.log(values);
  };

  return (
    <FormProvider {...methods}>
      <EuiFlexGroup direction="column" gutterSize="l">
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
            label={i18n.translate('xpack.observability.slo.sloSettings.stale.enabledRowLabel', {
              defaultMessage: 'Enable stale summary documents automatic deletion',
            })}
          >
            <Controller
              name="stale.enabled"
              control={control}
              defaultValue={false}
              render={({ field: { ref, onChange, ...field } }) => (
                <EuiSwitch
                  label={
                    field.value
                      ? i18n.translate('xpack.observability.slo.sloSettings.stale.enabledLabel', {
                          defaultMessage: 'Enabled',
                        })
                      : i18n.translate('xpack.observability.slo.sloSettings.stale.disabledLabel', {
                          defaultMessage: 'Disabled',
                        })
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
              defaultMessage: 'Duration in minutes before a summary document is considered stale',
            })}
          >
            <Controller
              name="stale.duration"
              control={control}
              defaultValue={2880}
              rules={{
                required: true,
                min: 1,
              }}
              render={({ field: { ref, onChange, ...field }, fieldState }) => (
                <EuiFieldNumber
                  {...field}
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
          <EuiButton color="primary" fill onClick={handleSubmit}>
            {i18n.translate('xpack.observability.slo.sloSettings.saveBtn', {
              defaultMessage: 'Save',
            })}
          </EuiButton>
        </EuiFlexGroup>
      </EuiFlexGroup>
    </FormProvider>
  );
}
