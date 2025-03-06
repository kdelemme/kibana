/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import kbnRison from '@kbn/rison';
import expect from '@kbn/expect';
import type { FtrProviderContext } from '../../ftr_provider_context';

export default function ({ getService, getPageObjects }: FtrProviderContext) {
  const PageObjects = getPageObjects([
    'common',
    'discover',
    'header',
    'unifiedFieldList',
    'context',
  ]);
  const dataViews = getService('dataViews');
  const dataGrid = getService('dataGrid');
  const browser = getService('browser');

  // Failing: See https://github.com/elastic/kibana/issues/213300
  describe.skip('extension getAdditionalCellActions', () => {
    describe('ES|QL mode', () => {
      it('should render additional cell actions for logs data source', async () => {
        const state = kbnRison.encode({
          dataSource: { type: 'esql' },
          query: { esql: 'from my-example-logs | sort @timestamp desc' },
        });
        await PageObjects.common.navigateToActualUrl('discover', `?_a=${state}`, {
          ensureCurrentUrl: false,
        });
        await PageObjects.header.waitUntilLoadingHasFinished();
        await PageObjects.discover.waitUntilSearchingHasFinished();
        await dataGrid.clickCellExpandButton(0, { columnName: '@timestamp' });
        await dataGrid.clickCellExpandPopoverAction('example-data-source-action');
        let alert = await browser.getAlert();
        try {
          expect(await alert?.getText()).to.be('Example data source action executed');
        } finally {
          await alert?.dismiss();
        }
        await dataGrid.clickCellExpandButton(0, { columnName: '@timestamp' });
        await dataGrid.clickCellExpandPopoverAction('another-example-data-source-action');
        alert = await browser.getAlert();
        try {
          expect(await alert?.getText()).to.be('Another example data source action executed');
        } finally {
          await alert?.dismiss();
        }
      });

      it('should not render incompatible cell action for message column', async () => {
        const state = kbnRison.encode({
          dataSource: { type: 'esql' },
          query: { esql: 'from my-example-logs | sort @timestamp desc' },
        });
        await PageObjects.common.navigateToActualUrl('discover', `?_a=${state}`, {
          ensureCurrentUrl: false,
        });
        await PageObjects.header.waitUntilLoadingHasFinished();
        await PageObjects.discover.waitUntilSearchingHasFinished();
        await dataGrid.clickCellExpandButton(0, { columnName: 'message' });
        expect(await dataGrid.cellExpandPopoverActionExists('example-data-source-action')).to.be(
          true
        );
        expect(
          await dataGrid.cellExpandPopoverActionExists('another-example-data-source-action')
        ).to.be(false);
      });

      it('should not render cell actions for incompatible data source', async () => {
        const state = kbnRison.encode({
          dataSource: { type: 'esql' },
          query: { esql: 'from my-example-metrics | sort @timestamp desc' },
        });
        await PageObjects.common.navigateToActualUrl('discover', `?_a=${state}`, {
          ensureCurrentUrl: false,
        });
        await PageObjects.header.waitUntilLoadingHasFinished();
        await PageObjects.discover.waitUntilSearchingHasFinished();
        await dataGrid.clickCellExpandButton(0, { columnName: '@timestamp' });
        expect(await dataGrid.cellExpandPopoverActionExists('example-data-source-action')).to.be(
          false
        );
        expect(
          await dataGrid.cellExpandPopoverActionExists('another-example-data-source-action')
        ).to.be(false);
      });
    });

    describe('data view mode', () => {
      it('should render additional cell actions for logs data source', async () => {
        await PageObjects.common.navigateToActualUrl('discover', undefined, {
          ensureCurrentUrl: false,
        });
        await dataViews.switchTo('my-example-logs');
        await PageObjects.header.waitUntilLoadingHasFinished();
        await PageObjects.discover.waitUntilSearchingHasFinished();
        await dataGrid.clickCellExpandButton(0, { columnName: '@timestamp' });
        await dataGrid.clickCellExpandPopoverAction('example-data-source-action');
        let alert = await browser.getAlert();
        try {
          expect(await alert?.getText()).to.be('Example data source action executed');
        } finally {
          await alert?.dismiss();
        }
        await dataGrid.clickCellExpandButton(0, { columnName: '@timestamp' });
        await dataGrid.clickCellExpandPopoverAction('another-example-data-source-action');
        alert = await browser.getAlert();
        try {
          expect(await alert?.getText()).to.be('Another example data source action executed');
        } finally {
          await alert?.dismiss();
        }
        // check Surrounding docs page
        await dataGrid.clickRowToggle();
        const [, surroundingActionEl] = await dataGrid.getRowActions();
        await surroundingActionEl.click();
        await PageObjects.header.waitUntilLoadingHasFinished();
        await browser.refresh();
        await PageObjects.header.waitUntilLoadingHasFinished();
        await PageObjects.discover.waitUntilSearchingHasFinished();
        await PageObjects.context.waitUntilContextLoadingHasFinished();
        await dataGrid.clickCellExpandButton(0, { columnName: '@timestamp' });
        await dataGrid.clickCellExpandPopoverAction('example-data-source-action');
        alert = await browser.getAlert();
        try {
          expect(await alert?.getText()).to.be('Example data source action executed');
        } finally {
          await alert?.dismiss();
        }
        await dataGrid.clickCellExpandButton(0, { columnName: '@timestamp' });
        await dataGrid.clickCellExpandPopoverAction('another-example-data-source-action');
        alert = await browser.getAlert();
        try {
          expect(await alert?.getText()).to.be('Another example data source action executed');
        } finally {
          await alert?.dismiss();
        }
      });

      it('should not render incompatible cell action for message column', async () => {
        await PageObjects.common.navigateToActualUrl('discover', undefined, {
          ensureCurrentUrl: false,
        });
        await dataViews.switchTo('my-example-logs');
        await PageObjects.header.waitUntilLoadingHasFinished();
        await PageObjects.discover.waitUntilSearchingHasFinished();
        await dataGrid.clickCellExpandButton(0, { columnName: 'message' });
        expect(await dataGrid.cellExpandPopoverActionExists('example-data-source-action')).to.be(
          true
        );
        expect(
          await dataGrid.cellExpandPopoverActionExists('another-example-data-source-action')
        ).to.be(false);
      });

      it('should not render cell actions for incompatible data source', async () => {
        await PageObjects.common.navigateToActualUrl('discover', undefined, {
          ensureCurrentUrl: false,
        });
        await dataViews.switchTo('my-example-metrics');
        await PageObjects.header.waitUntilLoadingHasFinished();
        await PageObjects.discover.waitUntilSearchingHasFinished();
        await dataGrid.clickCellExpandButton(0, { columnName: '@timestamp' });
        expect(await dataGrid.cellExpandPopoverActionExists('example-data-source-action')).to.be(
          false
        );
        expect(
          await dataGrid.cellExpandPopoverActionExists('another-example-data-source-action')
        ).to.be(false);
      });
    });
  });
}
