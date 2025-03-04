/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { ByteSizeValue } from '@kbn/config-schema';
import { IScopedClusterClient, Logger } from '@kbn/core/server';

import { fetchConnectorByIndexName } from '@kbn/search-connectors';

import { ENTERPRISE_SEARCH_CONNECTOR_CRAWLER_SERVICE_TYPE } from '../../../common/constants';

import { fetchCrawlerByIndexName } from '../crawler/fetch_crawlers';

import { fetchIndex } from './fetch_index';

jest.mock('@kbn/search-connectors', () => ({
  SyncStatus: {
    CANCELED: 'canceled',
    CANCELING: 'canceling',
    COMPLETED: 'completed',
    ERROR: 'error',
    IN_PROGRESS: 'in_progress',
    PENDING: 'pending',
    SUSPENDED: 'suspended',
  },
  fetchConnectorByIndexName: jest.fn(),
}));

jest.mock('../crawler/fetch_crawlers', () => ({
  fetchCrawlerByIndexName: jest.fn(),
}));

describe('fetchIndex lib function', () => {
  const mockClient = {
    asCurrentUser: {
      count: jest.fn().mockReturnValue({ count: 100 }),
      index: jest.fn(),
      indices: {
        get: jest.fn(),
        stats: jest.fn(),
      },
      search: jest.fn().mockReturnValue({
        hits: {
          hits: [{ _source: { status: 'in_progress' } }, { _source: { status: 'pending' } }],
        },
      }),
    },
    asInternalUser: {},
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  const logger = {
    error: jest.fn(),
  } as any as Logger;

  const statsResponse = {
    indices: {
      index_name: {
        health: 'green',
        hidden: false,
        size: new ByteSizeValue(108000).toString(),
        status: 'open',
        total: {
          docs: {
            count: 100,
            deleted: 0,
          },
          store: {
            size_in_bytes: 108000,
          },
        },
        uuid: '83a81e7e-5955-4255-b008-5d6961203f57',
      },
    },
  };

  const result = {
    aliases: [],
    count: 100,
    has_in_progress_syncs: false,
    has_pending_syncs: false,
    health: 'green',
    hidden: false,
    name: 'index_name',
    status: 'open',
    total: {
      docs: {
        count: 100,
        deleted: 0,
      },
      store: {
        size_in_bytes: '105.47kb',
      },
    },
    uuid: '83a81e7e-5955-4255-b008-5d6961203f57',
  };

  it('should return data and stats for index if no connector or crawler is present', async () => {
    mockClient.asCurrentUser.indices.get.mockImplementation(() =>
      Promise.resolve({
        index_name: { aliases: [], data: 'full index' },
      })
    );
    (fetchCrawlerByIndexName as jest.Mock).mockImplementationOnce(() => Promise.resolve(undefined));
    (fetchConnectorByIndexName as jest.Mock).mockImplementationOnce(() =>
      Promise.resolve(undefined)
    );
    mockClient.asCurrentUser.indices.stats.mockImplementation(() => Promise.resolve(statsResponse));

    await expect(
      fetchIndex(mockClient as unknown as IScopedClusterClient, 'index_name', logger)
    ).resolves.toEqual(result);
  });

  it('should return data and stats for index and connector if connector is present', async () => {
    mockClient.asCurrentUser.search.mockReturnValue({
      hits: {
        hits: [{ _source: { status: 'canceled' } }, { _source: { status: 'pending' } }],
      },
    });
    mockClient.asCurrentUser.indices.get.mockImplementation(() =>
      Promise.resolve({
        index_name: { aliases: [], data: 'full index' },
      })
    );
    (fetchConnectorByIndexName as jest.Mock).mockImplementationOnce(() =>
      Promise.resolve({
        doc: 'doc',
        service_type: 'some-service-type',
      })
    );
    mockClient.asCurrentUser.indices.stats.mockImplementation(() => Promise.resolve(statsResponse));

    await expect(
      fetchIndex(mockClient as unknown as IScopedClusterClient, 'index_name', logger)
    ).resolves.toEqual({
      ...result,
      connector: { doc: 'doc', service_type: 'some-service-type' },
      has_pending_syncs: true,
    });
  });

  it('should return data and stats for index and crawler if crawler is present', async () => {
    mockClient.asCurrentUser.indices.get.mockImplementation(() =>
      Promise.resolve({
        index_name: { aliases: [], data: 'full index' },
      })
    );
    (fetchCrawlerByIndexName as jest.Mock).mockImplementationOnce(() =>
      Promise.resolve({
        id: '1234',
      })
    );
    (fetchConnectorByIndexName as jest.Mock).mockImplementationOnce(() =>
      Promise.resolve(undefined)
    );
    mockClient.asCurrentUser.indices.stats.mockImplementation(() => Promise.resolve(statsResponse));

    await expect(
      fetchIndex(mockClient as unknown as IScopedClusterClient, 'index_name', logger)
    ).resolves.toEqual({
      ...result,
      crawler: {
        id: '1234',
      },
    });
  });

  it('should return data and stats for index and crawler if a crawler registered as a connector is present', async () => {
    mockClient.asCurrentUser.count.mockReturnValue({ count: 0 });
    mockClient.asCurrentUser.search.mockReturnValue({
      hits: {
        hits: [{ _source: { status: 'in_progress' } }, { _source: { status: 'completed' } }],
      },
    });
    mockClient.asCurrentUser.indices.get.mockImplementation(() =>
      Promise.resolve({
        index_name: { aliases: [], data: 'full index' },
      })
    );
    (fetchCrawlerByIndexName as jest.Mock).mockImplementationOnce(() =>
      Promise.resolve({
        id: '1234',
      })
    );
    (fetchConnectorByIndexName as jest.Mock).mockImplementationOnce(() =>
      Promise.resolve({
        doc: 'doc',
        service_type: ENTERPRISE_SEARCH_CONNECTOR_CRAWLER_SERVICE_TYPE,
      })
    );
    mockClient.asCurrentUser.indices.stats.mockImplementation(() => Promise.resolve(statsResponse));

    await expect(
      fetchIndex(mockClient as unknown as IScopedClusterClient, 'index_name', logger)
    ).resolves.toEqual({
      ...result,
      connector: { doc: 'doc', service_type: ENTERPRISE_SEARCH_CONNECTOR_CRAWLER_SERVICE_TYPE },
      count: 0,
      crawler: { id: '1234' },
      has_in_progress_syncs: true,
      has_pending_syncs: false,
    });
  });

  it('should throw a 404 error if the index cannot be fonud', async () => {
    mockClient.asCurrentUser.indices.get.mockImplementation(() => Promise.resolve({}));
    (fetchConnectorByIndexName as jest.Mock).mockImplementationOnce(() =>
      Promise.resolve(undefined)
    );
    mockClient.asCurrentUser.indices.stats.mockImplementation(() => Promise.resolve(statsResponse));

    await expect(
      fetchIndex(mockClient as unknown as IScopedClusterClient, 'index_name', logger)
    ).rejects.toEqual(new Error('404'));
  });
  it('should throw a 404 error if the indexStats cannot be fonud', async () => {
    mockClient.asCurrentUser.indices.get.mockImplementation(() =>
      Promise.resolve({
        index_name: { aliases: [] },
      })
    );
    (fetchConnectorByIndexName as jest.Mock).mockImplementationOnce(() =>
      Promise.resolve(undefined)
    );
    mockClient.asCurrentUser.indices.stats.mockImplementation(() =>
      Promise.resolve({ indices: {} })
    );

    await expect(
      fetchIndex(mockClient as unknown as IScopedClusterClient, 'index_name', logger)
    ).rejects.toEqual(new Error('404'));
  });
  it('should throw a 404 error if the index stats indices cannot be fonud', async () => {
    mockClient.asCurrentUser.indices.get.mockImplementation(() =>
      Promise.resolve({
        index_name: { aliases: [] },
      })
    );
    (fetchConnectorByIndexName as jest.Mock).mockImplementationOnce(() =>
      Promise.resolve(undefined)
    );
    mockClient.asCurrentUser.indices.stats.mockImplementation(() => Promise.resolve({}));

    await expect(
      fetchIndex(mockClient as unknown as IScopedClusterClient, 'index_name', logger)
    ).rejects.toEqual(new Error('404'));
  });
});
