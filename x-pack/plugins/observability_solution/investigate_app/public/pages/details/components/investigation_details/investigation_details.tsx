/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */
import datemath from '@elastic/datemath';
import { EuiFlexGroup, EuiFlexItem, EuiLoadingSpinner } from '@elastic/eui';
import { AuthenticatedUser } from '@kbn/security-plugin/common';
import React, { useEffect, useState } from 'react';
import { AddObservationUI } from '../../../../components/add_observation_ui';
import { InvestigateSearchBar } from '../../../../components/investigate_search_bar';
import { InvestigateWidgetGrid } from '../../../../components/investigate_widget_grid';
import { useFetchInvestigation } from '../../../../hooks/use_fetch_investigation';
import { useKibana } from '../../../../hooks/use_kibana';
import { InvestigationNotes } from '../investigation_notes/investigation_notes';

export function InvestigationDetails({
  user,
  investigationId,
}: {
  user: AuthenticatedUser;
  investigationId: string;
}) {
  const {
    dependencies: {
      start: { investigate },
    },
  } = useKibana();
  const itemDefinitions = investigate.getItemDefinitions();
  const { data: investigationData } = useFetchInvestigation({ id: investigationId });

  const {
    addItem,
    copyItem,
    deleteItem,
    investigation,
    setGlobalParameters,
    renderableInvestigation,
  } = investigate.useInvestigation({
    user,
    investigationData,
  });

  if (!investigation || !renderableInvestigation || !investigationData) {
    return <EuiLoadingSpinner />;
  }

  return (
    <EuiFlexGroup direction="row">
      <EuiFlexItem grow={8}>
        <EuiFlexGroup direction="column" gutterSize="s">
          <EuiFlexGroup direction="column" gutterSize="m">
            <EuiFlexItem>
              <InvestigateSearchBar
                dateRangeFrom={
                  investigationData
                    ? new Date(investigationData.params.timeRange.from).toISOString()
                    : undefined
                }
                dateRangeTo={
                  investigationData
                    ? new Date(investigationData.params.timeRange.to).toISOString()
                    : undefined
                }
                onQuerySubmit={async ({ dateRange }) => {
                  const nextDateRange = {
                    from: datemath.parse(dateRange.from)!.toISOString(),
                    to: datemath.parse(dateRange.to)!.toISOString(),
                  };
                  await setGlobalParameters({
                    ...renderableInvestigation.parameters,
                    timeRange: nextDateRange,
                  });
                }}
              />
            </EuiFlexItem>

            <EuiFlexItem grow={false}>
              <InvestigateWidgetGrid
                items={renderableInvestigation.items}
                onItemCopy={async (copiedItem) => {
                  return copyItem(copiedItem.id);
                }}
                onItemDelete={async (deletedItem) => {
                  return deleteItem(deletedItem.id);
                }}
              />
            </EuiFlexItem>
          </EuiFlexGroup>

          <AddObservationUI
            timeRange={renderableInvestigation.parameters.timeRange}
            onWidgetAdd={(widget) => {
              return addItem(widget);
            }}
          />
        </EuiFlexGroup>
      </EuiFlexItem>

      <EuiFlexItem grow={2}>
        <InvestigationNotes investigationId={investigationId} initialNotes={investigation.notes} />
      </EuiFlexItem>
    </EuiFlexGroup>
  );
}
