/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { EuiButton, EuiFlexGroup, EuiFlexItem, EuiIcon, EuiPanel, EuiTitle } from '@elastic/eui';
import { TextBasedLangEditor } from '@kbn/esql/public';
import { i18n } from '@kbn/i18n';
import { GlobalWidgetParameters, OnWidgetAdd } from '@kbn/investigate-plugin/public';
import React from 'react';
import { EsqlWidgetPreview } from './esql_widget_preview';

type Props = {
  onWidgetAdd: OnWidgetAdd;
} & GlobalWidgetParameters;

export function AddObservationUI({ onWidgetAdd, timeRange, query, filters }: Props) {
  const [isOpen, setIsOpen] = React.useState(false);

  const [isExpanded, setIsExpanded] = React.useState(false);
  const [esqlQuery, setEsqlQuery] = React.useState('FROM *');
  const [submittedEsqlQuery, setSubmittedEsqlQuery] = React.useState(esqlQuery);
  const [isPreviewOpen, setIsPreviewOpen] = React.useState(false);

  const resetState = () => {
    setIsExpanded(false);
    setIsPreviewOpen(false);
    setEsqlQuery('FROM *');
    setSubmittedEsqlQuery('FROM *');
  };

  if (!isOpen) {
    return (
      <EuiFlexGroup gutterSize="s">
        <EuiFlexItem grow={true}>
          <EuiButton
            data-test-subj="investigateAppAddObservationUIAddAnObservationChartButton"
            iconType="plusInCircle"
            onClick={() => setIsOpen(true)}
          >
            {i18n.translate(
              'xpack.investigateApp.addObservationUI.addAnObservationChartButtonLabel',
              { defaultMessage: 'Add an observation chart' }
            )}
          </EuiButton>
        </EuiFlexItem>
      </EuiFlexGroup>
    );
  }

  return (
    <EuiPanel paddingSize="l" grow={false}>
      <EuiFlexGroup direction="column" gutterSize="m">
        <EuiFlexItem grow={true}>
          <EuiTitle size="s">
            <h3>
              {i18n.translate(
                'xpack.investigateApp.addObservationUI.h2.addAnObservationChartLabel',
                { defaultMessage: 'Add an observation chart' }
              )}
            </h3>
          </EuiTitle>
        </EuiFlexItem>
        <EuiFlexItem grow={true}>
          <EuiPanel color="subdued" hasShadow={false}>
            <EuiFlexGroup direction="column" gutterSize="m">
              <EuiFlexItem>
                <TextBasedLangEditor
                  query={{ esql: esqlQuery }}
                  onTextLangQueryChange={(nextQuery) => {
                    setIsPreviewOpen(true);
                    setEsqlQuery(nextQuery.esql);
                    setSubmittedEsqlQuery(nextQuery.esql);
                  }}
                  onTextLangQuerySubmit={async (nextSubmittedQuery) => {
                    setSubmittedEsqlQuery(nextSubmittedQuery?.esql ?? '');
                  }}
                  errors={undefined}
                  warning={undefined}
                  expandCodeEditor={(expanded: boolean) => {
                    setIsExpanded(() => expanded);
                  }}
                  isCodeEditorExpanded={isExpanded}
                  hideMinimizeButton={false}
                  editorIsInline
                  hideRunQueryText
                  isLoading={false}
                  disableSubmitAction
                  isDisabled={false}
                  hideQueryHistory
                  hideTimeFilterInfo
                />
              </EuiFlexItem>

              {!isPreviewOpen ? (
                <EuiFlexGroup direction="column" alignItems="center" gutterSize="l">
                  <EuiFlexItem grow={false}>
                    <EuiIcon type="image" size="xxl" />
                  </EuiFlexItem>
                  <EuiFlexItem grow={false}>
                    <p>
                      {i18n.translate(
                        'xpack.investigateApp.addObservationUI.p.selectADataSourceLabel',
                        { defaultMessage: 'Select a data source to generate a preview chart' }
                      )}
                    </p>
                  </EuiFlexItem>
                </EuiFlexGroup>
              ) : (
                <EsqlWidgetPreview
                  filters={filters}
                  esqlQuery={submittedEsqlQuery}
                  timeRange={timeRange}
                  query={query}
                  onWidgetAdd={(widget) => {
                    resetState();
                    return onWidgetAdd(widget);
                  }}
                />
              )}
            </EuiFlexGroup>
          </EuiPanel>
        </EuiFlexItem>
        <EuiFlexGroup justifyContent="spaceBetween">
          <EuiFlexItem grow={false}>
            <EuiButton
              color="text"
              data-test-subj="investigateAppAddObservationUICancelButton"
              onClick={() => {
                resetState();
                setIsOpen(false);
              }}
            >
              {i18n.translate('xpack.investigateApp.addObservationUI.cancelButtonLabel', {
                defaultMessage: 'Cancel',
              })}
            </EuiButton>
          </EuiFlexItem>
          <EuiFlexItem grow={false}>
            <EuiButton
              color="primary"
              fill
              iconType="plusInCircle"
              data-test-subj="investigateAppAddObservationUIAddAnObservationChartButton"
            >
              {i18n.translate(
                'xpack.investigateApp.addObservationUI.addAnObservationChartButtonLabel',
                { defaultMessage: 'Add an observation chart' }
              )}
            </EuiButton>
          </EuiFlexItem>
        </EuiFlexGroup>
      </EuiFlexGroup>
    </EuiPanel>
  );
}
