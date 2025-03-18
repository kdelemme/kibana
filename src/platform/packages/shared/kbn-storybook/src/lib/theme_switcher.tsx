/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import React, { useCallback, useEffect } from 'react';
import { IconButton, TooltipLinkList, WithTooltip } from '@storybook/components';
import { useGlobals } from '@storybook/manager-api';
import { HeartIcon, HeartHollowIcon } from '@storybook/icons';

type PropsOf<T extends React.FC<any>> = T extends React.FC<infer P> ? P : never;
type ArrayItem<T extends any[]> = T extends Array<infer I> ? I : never;
type Link = ArrayItem<PropsOf<typeof TooltipLinkList>['links']>;

const defaultTheme = 'v8.light';

export function ThemeSwitcher() {
  const [{ euiTheme: selectedTheme }, updateGlobals] = useGlobals();

  const selectTheme = useCallback(
    (themeId: string) => {
      updateGlobals({ euiTheme: themeId });
    },
    [updateGlobals]
  );

  useEffect(() => {
    if (!selectedTheme) {
      selectTheme(defaultTheme);
    }
  }, [selectTheme, selectedTheme]);

  return (
    <WithTooltip
      placement="top"
      trigger="click"
      tooltip={({ onHide }) => (
        <ThemeSwitcherTooltip
          onHide={onHide}
          onChangeSelectedTheme={selectTheme}
          selectedTheme={selectedTheme}
        />
      )}
    >
      <IconButton key="eui-theme" title="Change the EUI theme">
        {selectedTheme?.includes('dark') ? <HeartIcon /> : <HeartHollowIcon />}
      </IconButton>
    </WithTooltip>
  );
}

const ThemeSwitcherTooltip = React.memo(
  ({
    onHide,
    onChangeSelectedTheme,
    selectedTheme,
  }: {
    onHide: () => void;
    onChangeSelectedTheme: (themeId: string) => void;
    selectedTheme: string;
  }) => {
    const links = [
      {
        id: 'v8.light',
        title: 'Light',
      },
      {
        id: 'v8.dark',
        title: 'Dark',
      },
    ].map(
      (link): Link => ({
        ...link,
        onClick: (_event, item) => {
          if (item.id != null && item.id !== selectedTheme) {
            onChangeSelectedTheme(item.id);
          }
          onHide();
        },
        active: selectedTheme === link.id,
      })
    );

    return <TooltipLinkList links={links.flat()} />;
  }
);
