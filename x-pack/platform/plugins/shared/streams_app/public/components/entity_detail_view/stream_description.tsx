/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { EuiFlexGroup, EuiFlexItem, EuiInlineEditText } from '@elastic/eui';
import { i18n } from '@kbn/i18n';
import { IngestStreamGetResponse, WiredIngest, isGroupStreamDefinition } from '@kbn/streams-schema';
import React from 'react';
import { useUpdateStreams } from '../../hooks/use_update_streams';

const EMPTY_DESCRIPTION_LABEL = i18n.translate(
  'xpack.streams.streamDescription.emptyDescriptionLabel',
  { defaultMessage: 'Add a description' }
);

interface Props {
  definition?: IngestStreamGetResponse;
}

export function StreamDescription({ definition }: Props) {
  const updateStream = useUpdateStreams(definition?.stream.name);

  if (!definition || isGroupStreamDefinition(definition.stream)) {
    return null;
  }

  return (
    <EuiFlexGroup alignItems="center" gutterSize="xs">
      <EuiFlexItem grow>
        <EuiInlineEditText
          inputAriaLabel="Edit Stream description"
          defaultValue={definition.stream.description ?? EMPTY_DESCRIPTION_LABEL}
          size="s"
          onSave={async (value) => {
            const sanitized = value.trim();

            await updateStream({
              dashboards: definition.dashboards,
              stream: {
                ingest: definition.stream.ingest as WiredIngest, // TODO: Fix types
                description: sanitized,
              },
            });
          }}
        />
      </EuiFlexItem>
    </EuiFlexGroup>
  );
}
