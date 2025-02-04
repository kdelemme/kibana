/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import React from 'react';
import { act } from 'react-dom/test-utils';
import { BehaviorSubject } from 'rxjs';

import { analyticsServiceMock } from '@kbn/core-analytics-browser-mocks';
import { applicationServiceMock } from '@kbn/core-application-browser-mocks';
import { chromeServiceMock } from '@kbn/core-chrome-browser-mocks';
import { overlayServiceMock } from '@kbn/core-overlays-browser-mocks';
import { userProfileServiceMock } from '@kbn/core-user-profile-browser-mocks';
import { themeServiceMock } from '@kbn/core-theme-browser-mocks';
import { i18nServiceMock } from '@kbn/core-i18n-browser-mocks';
import { RenderingService } from './rendering_service';

describe('RenderingService#start', () => {
  let analytics: ReturnType<typeof analyticsServiceMock.createAnalyticsServiceStart>;
  let application: ReturnType<typeof applicationServiceMock.createInternalStartContract>;
  let chrome: ReturnType<typeof chromeServiceMock.createStartContract>;
  let overlays: ReturnType<typeof overlayServiceMock.createStartContract>;
  let i18n: ReturnType<typeof i18nServiceMock.createStartContract>;
  let theme: ReturnType<typeof themeServiceMock.createStartContract>;
  let userProfile: ReturnType<typeof userProfileServiceMock.createStart>;
  let targetDomElement: HTMLDivElement;
  let rendering: RenderingService;

  beforeEach(() => {
    analytics = analyticsServiceMock.createAnalyticsServiceStart();

    application = applicationServiceMock.createInternalStartContract();
    application.getComponent.mockReturnValue(<div>Hello application!</div>);

    chrome = chromeServiceMock.createStartContract();
    chrome.getHeaderComponent.mockReturnValue(<div>Hello chrome!</div>);

    overlays = overlayServiceMock.createStartContract();
    overlays.banners.getComponent.mockReturnValue(<div>I&apos;m a banner!</div>);

    userProfile = userProfileServiceMock.createStart();
    theme = themeServiceMock.createStartContract();
    i18n = i18nServiceMock.createStartContract();

    targetDomElement = document.createElement('div');

    rendering = new RenderingService();
  });

  const startService = () => {
    return rendering.start({
      analytics,
      application,
      chrome,
      overlays,
      i18n,
      theme,
      userProfile,
      targetDomElement,
    });
  };

  it('renders application service into provided DOM element', () => {
    startService();
    expect(targetDomElement.querySelector('div.kbnAppWrapper')).toMatchInlineSnapshot(`
      <div
        class="kbnAppWrapper kbnAppWrapper--hiddenChrome"
        data-test-subj="kbnAppWrapper hiddenChrome"
      >
        <div
          id="app-fixed-viewport"
        />
        <div>
          Hello application!
        </div>
      </div>
    `);
  });

  it('adds the `kbnAppWrapper--hiddenChrome` class to the AppWrapper when chrome is hidden', () => {
    const isVisible$ = new BehaviorSubject(true);
    chrome.getIsVisible$.mockReturnValue(isVisible$);
    startService();

    const appWrapper = targetDomElement.querySelector('div.kbnAppWrapper')!;
    expect(appWrapper.className).toEqual('kbnAppWrapper');

    act(() => isVisible$.next(false));
    expect(appWrapper.className).toEqual('kbnAppWrapper kbnAppWrapper--hiddenChrome');

    act(() => isVisible$.next(true));
    expect(appWrapper.className).toEqual('kbnAppWrapper');
  });

  it('contains wrapper divs', () => {
    startService();
    expect(targetDomElement.querySelector('div.kbnAppWrapper')).toBeDefined();
  });

  it('renders the banner UI', () => {
    startService();
    expect(targetDomElement.querySelector('#globalBannerList')).toMatchInlineSnapshot(`
              <div
                id="globalBannerList"
              >
                <div>
                  I'm a banner!
                </div>
              </div>
          `);
  });

  it('adds global styles via `KibanaRootRenderingContext` `globalStyles` configuration', () => {
    startService();
    expect(document.querySelector(`style[data-emotion="eui-styles-global"]`)).toBeDefined();
  });
});
