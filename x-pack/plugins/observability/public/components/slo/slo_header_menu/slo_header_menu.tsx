/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { EuiHeaderLink } from '@elastic/eui';
import React from 'react';
import { paths } from '../../../../common/locators/paths';
import { HeaderMenu } from '../../header_menu/header_menu';
import { useKibana } from '../../../utils/kibana_react';

export function SloHeaderMenu({
  children,
}: {
  children?: React.ReactNode;
}): React.ReactElement | null {
  const {
    http: { basePath },
  } = useKibana().services;

  return (
    <HeaderMenu>
      <EuiHeaderLink
        color="primary"
        href={basePath.prepend(paths.observability.sloSettings)}
        iconType="indexSettings"
      >
        Settings
      </EuiHeaderLink>
    </HeaderMenu>
  );
}
