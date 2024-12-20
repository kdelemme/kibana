/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import { coreMock } from '@kbn/core/public/mocks';
import { testPlugin } from './tests/test_plugin';

describe('embeddable factory', () => {
  const coreSetup = coreMock.createSetup();
  const coreStart = coreMock.createStart();
  const { setup, doStart } = testPlugin(coreSetup, coreStart);
  const start = doStart();
  const embeddableFactoryId = 'ID';
  const embeddableFactory = {
    type: embeddableFactoryId,
    create: jest.fn(),
    getDisplayName: () => 'Test',
    isEditable: () => Promise.resolve(true),
    extract: jest.fn().mockImplementation((state) => ({ state, references: [] })),
    inject: jest.fn().mockImplementation((state) => state),
    telemetry: jest.fn().mockResolvedValue({}),
    latestVersion: '7.11.0',
    migrations: { '7.11.0': jest.fn().mockImplementation((state) => state) },
  } as any;
  const embeddableState = {
    id: embeddableFactoryId,
    type: embeddableFactoryId,
    my: 'state',
  } as any;

  const containerEmbeddableFactoryId = 'CONTAINER';
  const containerEmbeddableFactory = {
    type: containerEmbeddableFactoryId,
    latestVersion: '1.0.0',
    create: jest.fn(),
    getDisplayName: () => 'Container',
    isContainer: true,
    isEditable: () => Promise.resolve(true),
    extract: jest.fn().mockImplementation((state) => ({ state, references: [] })),
    inject: jest.fn().mockImplementation((state) => state),
    telemetry: jest.fn().mockResolvedValue({}),
    migrations: { '7.12.0': jest.fn().mockImplementation((state) => state) },
  };

  const containerState = {
    id: containerEmbeddableFactoryId,
    type: containerEmbeddableFactoryId,
    some: 'state',
    panels: [
      {
        ...embeddableState,
      },
    ],
  } as any;

  setup.registerEmbeddableFactory(embeddableFactoryId, embeddableFactory);
  setup.registerEmbeddableFactory(containerEmbeddableFactoryId, containerEmbeddableFactory);

  test('cannot register embeddable factory with the same ID', async () => {
    expect(() =>
      setup.registerEmbeddableFactory(embeddableFactoryId, embeddableFactory)
    ).toThrowError(
      'Embeddable factory [embeddableFactoryId = ID] already registered in Embeddables API.'
    );
  });

  test('embeddableFactory extract function gets called when calling embeddable extract', () => {
    start.extract(embeddableState);
    expect(embeddableFactory.extract).toBeCalledWith(embeddableState);
  });

  test('embeddableFactory inject function gets called when calling embeddable inject', () => {
    start.inject(embeddableState, []);
    expect(embeddableFactory.extract).toBeCalledWith(embeddableState);
  });

  test('embeddableFactory telemetry function gets called when calling embeddable telemetry', () => {
    start.telemetry(embeddableState, {});
    expect(embeddableFactory.telemetry).toBeCalledWith(embeddableState, {});
  });

  test('embeddableFactory migrate function gets called when calling embeddable migrate', () => {
    start.getAllMigrations!()['7.11.0']!(embeddableState);
    expect(embeddableFactory.migrations['7.11.0']).toBeCalledWith(embeddableState);
  });

  test('panels inside container get automatically migrated when migrating conta1iner', () => {
    start.getAllMigrations!()['7.11.0']!(containerState);
    expect(embeddableFactory.migrations['7.11.0']).toBeCalledWith(embeddableState);
  });

  test('migrateToLatest returns list of all migrations', () => {
    const migrations = start.getAllMigrations();
    expect(migrations).toMatchSnapshot();
  });

  test('migrateToLatest calls correct migrate functions', () => {
    start.migrateToLatest!({
      state: embeddableState,
      version: '7.11.0',
    });
    expect(embeddableFactory.migrations['7.11.0']).toBeCalledWith(embeddableState);
  });
});

describe('embeddable enhancements', () => {
  const coreSetup = coreMock.createSetup();
  const coreStart = coreMock.createStart();
  const { setup, doStart } = testPlugin(coreSetup, coreStart);
  const start = doStart();
  const embeddableEnhancement = {
    id: 'test',
    extract: jest.fn().mockImplementation((state) => ({ state, references: [] })),
    inject: jest.fn().mockImplementation((state) => state),
    telemetry: jest.fn().mockResolvedValue({}),
    migrations: { '7.11.0': jest.fn().mockImplementation((state) => state) },
  } as any;
  const embeddableState = {
    enhancements: {
      test: {
        my: 'state',
      },
    },
  } as any;

  setup.registerEnhancement(embeddableEnhancement);

  test('cannot register embeddable enhancement with the same ID', async () => {
    expect(() => setup.registerEnhancement(embeddableEnhancement)).toThrowError(
      'enhancement with id test already exists in the registry'
    );
  });

  test('enhancement extract function gets called when calling embeddable extract', () => {
    start.extract(embeddableState);
    expect(embeddableEnhancement.extract).toBeCalledWith(embeddableState.enhancements.test);
  });

  test('enhancement inject function gets called when calling embeddable inject', () => {
    start.inject(embeddableState, []);
    expect(embeddableEnhancement.extract).toBeCalledWith(embeddableState.enhancements.test);
  });

  test('enhancement telemetry function gets called when calling embeddable telemetry', () => {
    start.telemetry(embeddableState, {});
    expect(embeddableEnhancement.telemetry).toBeCalledWith(embeddableState.enhancements.test, {});
  });

  test('enhancement migrate function gets called when calling embeddable migrate', () => {
    start.getAllMigrations!()['7.11.0']!(embeddableState);
    expect(embeddableEnhancement.migrations['7.11.0']).toBeCalledWith(
      embeddableState.enhancements.test
    );
  });

  test('doesnt fail if there is no migration function registered for specific version', () => {
    expect(() => {
      start.getAllMigrations!()['7.11.0']!(embeddableState);
    }).not.toThrow();

    expect(start.getAllMigrations!()['7.11.0']!(embeddableState)).toEqual(embeddableState);
  });
});
