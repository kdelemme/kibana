/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import type {
  RuleEqlQuery,
  ThreeVersionsOf,
} from '../../../../../../../../common/api/detection_engine';
import {
  ThreeWayDiffOutcome,
  ThreeWayMergeOutcome,
  MissingVersion,
  ThreeWayDiffConflict,
} from '../../../../../../../../common/api/detection_engine';
import { eqlQueryDiffAlgorithm } from './eql_query_diff_algorithm';

describe('eqlQueryDiffAlgorithm', () => {
  it('returns current_version as merged output if there is no update - scenario AAA', () => {
    const mockVersions: ThreeVersionsOf<RuleEqlQuery> = {
      base_version: {
        query: 'query where true',
        language: 'eql',
        filters: [],
      },
      current_version: {
        query: 'query where true',
        language: 'eql',
        filters: [],
      },
      target_version: {
        query: 'query where true',
        language: 'eql',
        filters: [],
      },
    };

    const result = eqlQueryDiffAlgorithm(mockVersions, false);

    expect(result).toEqual(
      expect.objectContaining({
        merged_version: mockVersions.current_version,
        diff_outcome: ThreeWayDiffOutcome.StockValueNoUpdate,
        merge_outcome: ThreeWayMergeOutcome.Current,
        conflict: ThreeWayDiffConflict.NONE,
      })
    );
  });

  it('returns current_version as merged output if current_version is different and there is no update - scenario ABA', () => {
    const mockVersions: ThreeVersionsOf<RuleEqlQuery> = {
      base_version: {
        query: 'query where true',
        language: 'eql',
        filters: [],
      },
      current_version: {
        query: 'query where false',
        language: 'eql',
        filters: [],
      },
      target_version: {
        query: 'query where true',
        language: 'eql',
        filters: [],
      },
    };

    const result = eqlQueryDiffAlgorithm(mockVersions, false);

    expect(result).toEqual(
      expect.objectContaining({
        merged_version: mockVersions.current_version,
        diff_outcome: ThreeWayDiffOutcome.CustomizedValueNoUpdate,
        merge_outcome: ThreeWayMergeOutcome.Current,
        conflict: ThreeWayDiffConflict.NONE,
      })
    );
  });

  it('returns target_version as merged output if current_version is the same and there is an update - scenario AAB', () => {
    const mockVersions: ThreeVersionsOf<RuleEqlQuery> = {
      base_version: {
        query: 'query where true',
        language: 'eql',
        filters: [],
      },
      current_version: {
        query: 'query where true',
        language: 'eql',
        filters: [],
      },
      target_version: {
        query: 'query where true',
        language: 'eql',
        filters: [{ query: 'some_field' }],
      },
    };

    const result = eqlQueryDiffAlgorithm(mockVersions, false);

    expect(result).toEqual(
      expect.objectContaining({
        merged_version: mockVersions.target_version,
        diff_outcome: ThreeWayDiffOutcome.StockValueCanUpdate,
        merge_outcome: ThreeWayMergeOutcome.Target,
        conflict: ThreeWayDiffConflict.NONE,
      })
    );
  });

  it('returns current_version as merged output if current version is different but it matches the update - scenario ABB', () => {
    const mockVersions: ThreeVersionsOf<RuleEqlQuery> = {
      base_version: {
        query: 'query where true',
        language: 'eql',
        filters: [],
      },
      current_version: {
        query: 'query where false',
        language: 'eql',
        filters: [],
      },
      target_version: {
        query: 'query where false',
        language: 'eql',
        filters: [],
      },
    };

    const result = eqlQueryDiffAlgorithm(mockVersions, false);

    expect(result).toEqual(
      expect.objectContaining({
        merged_version: mockVersions.current_version,
        diff_outcome: ThreeWayDiffOutcome.CustomizedValueSameUpdate,
        merge_outcome: ThreeWayMergeOutcome.Current,
        conflict: ThreeWayDiffConflict.NONE,
      })
    );
  });

  describe('if all three versions are different - scenario ABC', () => {
    it('returns the current_version with a non-solvable conflict', () => {
      const mockVersions: ThreeVersionsOf<RuleEqlQuery> = {
        base_version: {
          query: 'query where false',
          language: 'eql',
          filters: [],
        },
        current_version: {
          query: 'query where true',
          language: 'eql',
          filters: [],
        },
        target_version: {
          query: 'query two where false',
          language: 'eql',
          filters: [],
        },
      };

      const result = eqlQueryDiffAlgorithm(mockVersions, false);

      expect(result).toEqual(
        expect.objectContaining({
          merged_version: mockVersions.current_version,
          diff_outcome: ThreeWayDiffOutcome.CustomizedValueCanUpdate,
          merge_outcome: ThreeWayMergeOutcome.Current,
          conflict: ThreeWayDiffConflict.NON_SOLVABLE,
        })
      );
    });

    it('returns the current_version with a non-solvable conflict if one subfield has an ABA scenario and another has an AAB', () => {
      const mockVersions: ThreeVersionsOf<RuleEqlQuery> = {
        base_version: {
          query: 'query where false',
          language: 'eql',
          filters: [],
        },
        current_version: {
          query: 'query where false',
          language: 'eql',
          filters: [{ field: 'some query' }],
        },
        target_version: {
          query: 'query where true',
          language: 'eql',
          filters: [],
        },
      };

      const result = eqlQueryDiffAlgorithm(mockVersions, false);

      expect(result).toEqual(
        expect.objectContaining({
          merged_version: mockVersions.current_version,
          diff_outcome: ThreeWayDiffOutcome.CustomizedValueCanUpdate,
          merge_outcome: ThreeWayMergeOutcome.Current,
          conflict: ThreeWayDiffConflict.NON_SOLVABLE,
        })
      );
    });
  });

  describe('if base_version is missing', () => {
    describe('if current_version and target_version are the same - scenario -AA', () => {
      it('returns NONE conflict if rule is NOT customized', () => {
        const mockVersions: ThreeVersionsOf<RuleEqlQuery> = {
          base_version: MissingVersion,
          current_version: {
            query: 'query where true',
            language: 'eql',
            filters: [],
          },
          target_version: {
            query: 'query where true',
            language: 'eql',
            filters: [],
          },
        };

        const result = eqlQueryDiffAlgorithm(mockVersions, false);

        expect(result).toEqual(
          expect.objectContaining({
            has_base_version: false,
            base_version: undefined,
            merged_version: mockVersions.target_version,
            diff_outcome: ThreeWayDiffOutcome.MissingBaseNoUpdate,
            merge_outcome: ThreeWayMergeOutcome.Target,
            conflict: ThreeWayDiffConflict.NONE,
          })
        );
      });

      it('returns NONE conflict if rule is customized', () => {
        const mockVersions: ThreeVersionsOf<RuleEqlQuery> = {
          base_version: MissingVersion,
          current_version: {
            query: 'query where true',
            language: 'eql',
            filters: [],
          },
          target_version: {
            query: 'query where true',
            language: 'eql',
            filters: [],
          },
        };

        const result = eqlQueryDiffAlgorithm(mockVersions, true);

        expect(result).toEqual(
          expect.objectContaining({
            has_base_version: false,
            base_version: undefined,
            merged_version: mockVersions.target_version,
            diff_outcome: ThreeWayDiffOutcome.MissingBaseNoUpdate,
            merge_outcome: ThreeWayMergeOutcome.Target,
            conflict: ThreeWayDiffConflict.NONE,
          })
        );
      });
    });

    describe('if current_version and target_version are different - scenario -AB', () => {
      it('returns NONE conflict if rule is NOT customized', () => {
        const mockVersions: ThreeVersionsOf<RuleEqlQuery> = {
          base_version: MissingVersion,
          current_version: {
            query: 'query where true',
            language: 'eql',
            filters: [],
          },
          target_version: {
            query: 'query where false',
            language: 'eql',
            filters: [],
          },
        };

        const result = eqlQueryDiffAlgorithm(mockVersions, false);

        expect(result).toEqual(
          expect.objectContaining({
            has_base_version: false,
            base_version: undefined,
            merged_version: mockVersions.target_version,
            diff_outcome: ThreeWayDiffOutcome.MissingBaseCanUpdate,
            merge_outcome: ThreeWayMergeOutcome.Target,
            conflict: ThreeWayDiffConflict.NONE,
          })
        );
      });

      it('returns SOLVABLE conflict if rule is customized', () => {
        const mockVersions: ThreeVersionsOf<RuleEqlQuery> = {
          base_version: MissingVersion,
          current_version: {
            query: 'query where true',
            language: 'eql',
            filters: [],
          },
          target_version: {
            query: 'query where false',
            language: 'eql',
            filters: [],
          },
        };

        const result = eqlQueryDiffAlgorithm(mockVersions, true);

        expect(result).toEqual(
          expect.objectContaining({
            has_base_version: false,
            base_version: undefined,
            merged_version: mockVersions.target_version,
            diff_outcome: ThreeWayDiffOutcome.MissingBaseCanUpdate,
            merge_outcome: ThreeWayMergeOutcome.Target,
            conflict: ThreeWayDiffConflict.SOLVABLE,
          })
        );
      });
    });
  });
});
