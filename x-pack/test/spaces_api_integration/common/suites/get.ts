/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import type { SuperAgent } from 'superagent';

import expect from '@kbn/expect';

import { getTestScenariosForSpace } from '../lib/space_test_utils';
import type { DescribeFn, TestDefinitionAuthentication } from '../lib/types';

interface GetTest {
  statusCode: number;
  response: (resp: { [key: string]: any }) => void;
}

interface GetTests {
  default: GetTest;
}

interface GetTestDefinition {
  user?: TestDefinitionAuthentication;
  currentSpaceId: string;
  spaceId: string;
  tests: GetTests;
}

const nonExistantSpaceId = 'not-a-space';

export function getTestSuiteFactory(esArchiver: any, supertest: SuperAgent<any>) {
  const createExpectEmptyResult = () => (resp: { [key: string]: any }) => {
    expect(resp.body).to.eql('');
  };

  const createExpectNotFoundResult = () => (resp: { [key: string]: any }) => {
    expect(resp.body).to.eql({
      error: 'Not Found',
      message: 'Not Found',
      statusCode: 404,
    });
  };

  const createExpectRbacForbidden = (spaceId: string) => (resp: { [key: string]: any }) => {
    expect(resp.body).to.eql({
      statusCode: 403,
      error: 'Forbidden',
      message: `Unauthorized to get ${spaceId} space`,
    });
  };

  const createExpectResults = (spaceId: string) => (resp: { [key: string]: any }) => {
    const allSpaces = [
      {
        id: 'default',
        name: 'Default',
        color: '#00bfb3',
        description: 'This is your default space!',
        _reserved: true,
        disabledFeatures: [],
      },
      {
        id: 'space_1',
        name: 'Space 1',
        description: 'This is the first test space',
        disabledFeatures: [],
      },
      {
        id: 'space_2',
        name: 'Space 2',
        description: 'This is the second test space',
        disabledFeatures: [],
      },
      {
        id: 'space_3',
        name: 'Space 3',
        description: 'This is the third test space',
        solution: 'es',
        disabledFeatures: [
          // Disabled features are automatically added to the space when a solution is set
          'apm',
          'infrastructure',
          'inventory',
          'logs',
          'observabilityCases',
          'observabilityCasesV2',
          'observabilityCasesV3',
          'securitySolutionAssistant',
          'securitySolutionAttackDiscovery',
          'securitySolutionCases',
          'securitySolutionCasesV2',
          'securitySolutionCasesV3',
          'securitySolutionNotes',
          'securitySolutionTimeline',
          'siem',
          'siemV2',
          'slo',
          'uptime',
        ],
      },
    ];

    const disabledFeatures = (resp.body.disabledFeatures ?? []).sort();

    const expectedSpace = allSpaces.find((space) => space.id === spaceId);
    if (expectedSpace) {
      expectedSpace.disabledFeatures.sort();
    }

    expect({ ...resp.body, disabledFeatures }).to.eql(expectedSpace);
  };

  const makeGetTest =
    (describeFn: DescribeFn) =>
    (description: string, { user = {}, currentSpaceId, spaceId, tests }: GetTestDefinition) => {
      describeFn(description, () => {
        before(() =>
          esArchiver.load(
            'x-pack/test/spaces_api_integration/common/fixtures/es_archiver/saved_objects/spaces'
          )
        );
        after(() =>
          esArchiver.unload(
            'x-pack/test/spaces_api_integration/common/fixtures/es_archiver/saved_objects/spaces'
          )
        );

        getTestScenariosForSpace(currentSpaceId).forEach(({ urlPrefix, scenario }) => {
          it(`should return ${tests.default.statusCode} ${scenario}`, async () => {
            return supertest
              .get(`${urlPrefix}/api/spaces/space/${spaceId}`)
              .auth(user.username, user.password)
              .expect(tests.default.statusCode)
              .then(tests.default.response);
          });
        });
      });
    };

  const getTest = makeGetTest(describe);
  // @ts-ignore
  getTest.only = makeGetTest(describe);

  return {
    createExpectResults,
    createExpectRbacForbidden,
    createExpectEmptyResult,
    createExpectNotFoundResult,
    getTest,
    nonExistantSpaceId,
  };
}
