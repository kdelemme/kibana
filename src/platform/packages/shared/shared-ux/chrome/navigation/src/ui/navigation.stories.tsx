/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import type { Meta } from '@storybook/react';
import React, { EventHandler, FC, MouseEvent, useState, useEffect } from 'react';
import { of } from 'rxjs';

import {
  EuiButton,
  EuiCallOut,
  EuiCollapsibleNavBeta,
  EuiCollapsibleNavBetaProps,
  EuiFlexGroup,
  EuiFlexItem,
  EuiHeader,
  EuiHeaderSection,
  EuiPageTemplate,
  EuiSpacer,
} from '@elastic/eui';

import type {
  ChromeProjectNavigationNode,
  NavigationTreeDefinitionUI,
} from '@kbn/core-chrome-browser';
import { NavigationStorybookMock } from '../../mocks';
import type { NavigationServices } from '../types';
import { NavigationProvider } from '../services';
import { Navigation } from './navigation';

const storybookMock = new NavigationStorybookMock();

interface Props {
  clickAction?: EventHandler<MouseEvent>;
  clickActionText?: string;
  children?: React.ReactNode | (({ isCollapsed }: { isCollapsed: boolean }) => React.ReactNode);
}

const NavigationWrapper: FC<Props & Omit<Partial<EuiCollapsibleNavBetaProps>, 'children'>> = (
  props
) => {
  const [isCollapsed, setIsCollapsed] = useState(false);

  const onCollapseToggle = (nextIsCollapsed: boolean) => {
    setIsCollapsed(nextIsCollapsed);
  };

  useEffect(() => {
    // Set padding to body to avoid unnecessary scrollbars
    document.body.style.paddingTop = '0px';
    document.body.style.paddingRight = '0px';
    document.body.style.paddingBottom = '0px';
  }, []);

  return (
    <>
      <EuiHeader position="fixed">
        <EuiHeaderSection side={props?.side}>
          <EuiCollapsibleNavBeta
            {...props}
            children={
              typeof props.children === 'function'
                ? props.children({ isCollapsed })
                : props.children
            }
            initialIsCollapsed={isCollapsed}
            onCollapseToggle={onCollapseToggle}
            css={
              props.css ?? {
                overflow: 'visible',
                clipPath: 'polygon(0 0, 300% 0, 300% 100%, 0 100%)',
              }
            }
          />
        </EuiHeaderSection>
      </EuiHeader>
      <EuiPageTemplate>
        <EuiPageTemplate.Section>
          {props.clickAction ? (
            <EuiButton color="text" onClick={props.clickAction}>
              {props.clickActionText ?? 'Click me'}
            </EuiButton>
          ) : (
            <p>Hello world</p>
          )}
        </EuiPageTemplate.Section>
      </EuiPageTemplate>
    </>
  );
};

const generalLayoutNavTree: NavigationTreeDefinitionUI = {
  id: 'es',
  body: [
    // My custom project
    {
      id: 'example_project',
      path: '',
      title: 'Solution name',
      isCollapsible: false,
      icon: 'logoElastic',
      children: [
        {
          id: 'item01',
          path: '',
          title: 'Item 01',
          href: '/app/kibana',
          icon: 'iInCircle',
          isExternalLink: true,
        },
        {
          id: 'item02',
          path: '',
          title: 'Item 02',
          href: '/app/kibana',
          icon: 'iInCircle',
        },
        {
          id: 'root-section1',
          path: '',
          title: 'Section one',
          children: [
            {
              id: 'item03',
              path: '',
              title: 'Item 03',
              icon: 'iInCircle',
              renderAs: 'panelOpener',
              children: [
                {
                  id: 'sub0',
                  path: '',
                  title: 'This text is not shown',
                  renderItem: () => (
                    <>
                      <p>This panel contains a mix of ungrouped items and grouped items</p>
                      <EuiSpacer />
                    </>
                  ),
                },
                {
                  id: 'sub1',
                  path: '',
                  title: 'Item 11',
                  href: '/app/kibana',
                  icon: 'iInCircle',
                },
                {
                  id: 'sub2',
                  path: '',
                  title: 'Item 12',
                  href: '/app/kibana',
                  icon: 'iInCircle',
                },
                {
                  id: 'sub3',
                  path: '',
                  title: 'Item 13',
                  href: '/app/kibana',
                  icon: 'iInCircle',
                },
                {
                  id: 'child-section1',
                  path: '',
                  title: 'Section one',
                  children: [
                    {
                      id: 'sub1',
                      path: '',
                      title: 'Item 14',
                      href: '/app/kibana',
                      icon: 'iInCircle',
                      withBadge: true,
                    },
                    {
                      id: 'sub2',
                      path: '',
                      title: 'Item 15',
                      href: '/app/kibana',
                      icon: 'iInCircle',
                    },
                    {
                      id: 'sub3',
                      path: '',
                      title: 'Item 16',
                      href: '/app/kibana',
                      icon: 'iInCircle',
                    },
                  ],
                },
                {
                  id: 'child-section2',
                  path: '',
                  title: 'Section two',
                  children: [
                    {
                      id: 'sub1',
                      path: '',
                      title: 'Item 17',
                      href: '/app/kibana',
                      icon: 'iInCircle',
                      isExternalLink: true,
                    },
                    {
                      id: 'sub2',
                      path: '',
                      title: 'Just if we want to bring back those icons at some point',
                      href: '/app/kibana',
                      icon: 'dashboardApp',
                    },
                    {
                      id: 'sub3',
                      path: '',
                      title: 'Item 18',
                      href: '/app/kibana',
                      icon: 'iInCircle',
                    },
                  ],
                },
                {
                  id: 'child-section3',
                  path: '',
                  title: 'Item 19',
                  icon: 'iInCircle',
                  renderAs: 'accordion',
                  children: [
                    {
                      id: 'sub1',
                      path: '',
                      title: 'Item-Beta',
                      href: '/app/kibana',
                      withBadge: true,
                    },
                  ],
                },
                {
                  id: 'child-section4',
                  title: 'Parent item, opened',
                  path: '',
                  icon: 'iInCircle',
                  renderAs: 'accordion',
                  defaultIsCollapsed: false,
                  children: [
                    {
                      id: 'sub1',
                      path: '',
                      title: 'Item 20',
                      href: '/app/kibana',
                    },
                    {
                      id: 'sub2',
                      path: '',
                      title: 'Item 21',
                      href: '/app/kibana',
                    },
                    {
                      id: 'sub3',
                      path: '',
                      title: 'Item 22',
                      href: '/app/kibana',
                    },
                  ],
                },
              ],
            },
            {
              id: 'item04',
              path: '',
              title: 'Item 04',
              href: '/app/kibana',
              icon: 'iInCircle',
            },
            {
              id: 'item05',
              title: 'Item 05, with custom',
              path: '',
              icon: 'iInCircle',
              renderAs: 'panelOpener',
              children: [
                {
                  id: 'sub1',
                  path: '',
                  title: 'Item 23',
                  href: '/app/kibana',
                  icon: 'iInCircle',
                },
                {
                  id: 'spacer1',
                  path: '',
                  title: 'This text is not shown.',
                  renderItem: () => {
                    return <EuiSpacer />;
                  },
                },
                {
                  id: 'callout1',
                  path: '',
                  title: 'This text is not shown.',
                  renderItem: () => {
                    return (
                      <EuiCallOut title="Check it out" iconType="cluster">
                        <EuiFlexGroup justifyContent="spaceAround" direction="column">
                          <EuiFlexItem>
                            <p>Choose an integration to start</p>
                            <EuiButton>Browse integrations</EuiButton>
                          </EuiFlexItem>
                        </EuiFlexGroup>
                      </EuiCallOut>
                    );
                  },
                },
              ],
            },
          ],
        },
        {
          id: 'root-section2',
          title: 'Section two',
          path: '',
          children: [
            {
              id: 'item06',
              icon: 'iInCircle',
              title: 'Item 06',
              path: '',
              renderAs: 'panelOpener',
              children: [
                {
                  id: 'sub1',
                  path: '',
                  title: 'Item 24',
                  href: '/app/kibana',
                  icon: 'iInCircle',
                },
              ],
            },
            {
              id: 'item07',
              path: '',
              title: 'Item 07',
              href: '/app/kibana',
              icon: 'iInCircle',
            },
            {
              id: 'item08',
              path: '',
              title: 'Item 08',
              href: '/app/kibana',
              icon: 'iInCircle',
            },
          ],
        },
        {
          id: 'root-section3',
          title: 'Standalone item with long name',
          path: '',
          href: '/app/kibana',
          icon: 'iInCircle',
        },
        {
          id: 'root-section4',
          title: 'Standalone group item with long name',
          path: '',
          icon: 'iInCircle',
          renderAs: 'panelOpener',
          children: [
            {
              id: 'item25',
              path: '',
              title: 'Item 25',
              href: '/app/kibana',
              icon: 'iInCircle',
            },
            {
              id: 'item26',
              path: '',
              title: 'Item 26',
              href: '/app/kibana',
              icon: 'iInCircle',
            },
            {
              id: 'item27',
              path: '',
              title: 'Item 27',
              href: '/app/kibana',
              icon: 'iInCircle',
            },
          ],
        },
        {
          id: 'item09',
          title: 'Item 09',
          path: '',
          renderAs: 'accordion',
          icon: 'iInCircle',
          children: [
            {
              id: 'item-beta',
              path: '',
              title: 'Item-Beta',
              href: '/app/kibana',
              withBadge: true,
              isExternalLink: true,
            },
            {
              id: 'item-labs',
              path: '',
              title: 'Item-Labs',
              href: '/app/kibana',
              withBadge: true,
            },
            {
              id: 'item27',
              path: '',
              title: 'Item 27 - name plus badge & icon',
              renderAs: 'panelOpener',
              children: [
                {
                  id: 'sub1',
                  path: '',
                  title: 'Item 28',
                  href: '/app/kibana',
                  icon: 'iInCircle',
                },
              ],
            },
          ],
        },
      ],
    },
  ],
  footer: [
    {
      id: 'footer-section5',
      title: 'Parent item, closed',
      path: '',
      renderAs: 'accordion',
      icon: 'iInCircle',
      children: [
        {
          id: 'item29',
          path: '',
          title: 'Item 29',
          href: '/app/kibana',
          icon: 'iInCircle',
        },
        {
          id: 'item30',
          path: '',
          title: 'Item 30',
          href: '/app/kibana',
          icon: 'iInCircle',
        },
        {
          id: 'item31',
          path: '',
          title: 'Item 31',
          href: '/app/kibana',
          icon: 'iInCircle',
        },
        {
          id: 'sub-accordion',
          icon: 'iInCircle',
          title: 'Sub-Accordion',
          path: '',
          renderAs: 'accordion',
          children: [
            {
              id: 'sub1',
              path: '',
              title: 'Item 32',
              href: '/app/kibana',
              icon: 'iInCircle',
            },
          ],
        },
      ],
    },
    { id: 'item10', path: '', title: 'Item 10', icon: 'iInCircle', href: '/app/kibana' },
    {
      id: 'footer-section6',
      title: 'Parent item, opened',
      path: '',
      renderAs: 'accordion',
      icon: 'iInCircle',
      defaultIsCollapsed: false,
      children: [
        {
          id: 'item33',
          path: '',
          title: 'Item 33',
          href: '/app/kibana',
          icon: 'iInCircle',
        },
        {
          id: 'item34',
          path: '',
          title: 'Item 34',
          href: '/app/kibana',
          icon: 'iInCircle',
        },
        {
          id: 'item35',
          path: '',
          title: 'Item 35',
          href: '/app/kibana',
          icon: 'iInCircle',
          openInNewTab: true, // FIXME: show "popout" icon aligned to the right
        },
      ],
    },
  ],
};

/**
 * The "path" fields are statically defined as empty strings.
 * In Kibana, these will be dynamically defined based on where the item is within the tree.
 * This helper function dynamically defines each path.
 */
function correctPaths(sourceTree: ChromeProjectNavigationNode[], contextId = '') {
  const result: ChromeProjectNavigationNode[] = [];
  for (const key in sourceTree) {
    if (Object.prototype.hasOwnProperty.call(sourceTree, key)) {
      const current = sourceTree[key];
      const currentId = contextId ? `${contextId}.${current.id}` : current.id;
      current.path = currentId;
      if (current.children) {
        current.children = correctPaths(current.children, currentId);
      }
      result[key] = current;
    }
  }
  return result;
}

generalLayoutNavTree.body = correctPaths(
  generalLayoutNavTree.body as ChromeProjectNavigationNode[]
);
generalLayoutNavTree.footer = correctPaths(
  generalLayoutNavTree.footer as ChromeProjectNavigationNode[]
);

export const GeneralLayoutStructure = (args: NavigationServices) => {
  const services = storybookMock.getServices(args);

  return (
    <NavigationWrapper>
      {({ isCollapsed }) => (
        <NavigationProvider {...services} isSideNavCollapsed={isCollapsed}>
          <Navigation navigationTree$={of(generalLayoutNavTree)} />
        </NavigationProvider>
      )}
    </NavigationWrapper>
  );
};

export default {
  title: 'Chrome/Navigation',
  description: 'Navigation container to render items for cross-app linking',
  parameters: {},
  component: GeneralLayoutStructure,
} as Meta<typeof GeneralLayoutStructure>;
