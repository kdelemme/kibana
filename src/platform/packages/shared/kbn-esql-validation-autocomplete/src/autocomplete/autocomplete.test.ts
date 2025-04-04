/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import { suggest } from './autocomplete';
import { scalarFunctionDefinitions } from '../definitions/generated/scalar_functions';
import { timeUnitsToSuggest } from '../definitions/literals';
import { commandDefinitions as unmodifiedCommandDefinitions } from '../definitions/commands';
import { getSafeInsertText, TIME_SYSTEM_PARAMS, TRIGGER_SUGGESTION_COMMAND } from './factories';
import { getAstAndSyntaxErrors } from '@kbn/esql-ast';
import {
  policies,
  getFunctionSignaturesByReturnType,
  getFieldNamesByType,
  createCustomCallbackMocks,
  createCompletionContext,
  getPolicyFields,
  PartialSuggestionWithText,
  TIME_PICKER_SUGGESTION,
  setup,
  attachTriggerCommand,
  SuggestOptions,
  fields,
} from './__tests__/helpers';
import { METADATA_FIELDS } from '../shared/constants';
import { ESQL_STRING_TYPES } from '../shared/esql_types';
import { getRecommendedQueries } from './recommended_queries/templates';
import { getDateHistogramCompletionItem } from './commands/stats/util';
import { Location } from '../definitions/types';

const commandDefinitions = unmodifiedCommandDefinitions.filter(({ hidden }) => !hidden);

const getRecommendedQueriesSuggestions = (fromCommand: string, timeField?: string) =>
  getRecommendedQueries({
    fromCommand,
    timeField,
  });

describe('autocomplete', () => {
  type TestArgs = [
    string,
    Array<string | PartialSuggestionWithText>,
    string?,
    Parameters<typeof createCustomCallbackMocks>?
  ];

  const _testSuggestionsFn = (
    { only, skip }: { only?: boolean; skip?: boolean } = {},
    statement: string,
    expected: Array<string | PartialSuggestionWithText>,
    triggerCharacter?: string,
    customCallbacksArgs: Parameters<typeof createCustomCallbackMocks> = [
      undefined,
      undefined,
      undefined,
    ]
  ) => {
    const testFn = only ? test.only : skip ? test.skip : test;
    testFn(statement, async () => {
      const callbackMocks = createCustomCallbackMocks(...customCallbacksArgs);
      const { assertSuggestions } = await setup();
      await assertSuggestions(statement, expected, { callbacks: callbackMocks, triggerCharacter });
    });
  };

  // Enrich the function to work with .only and .skip as regular test function
  //
  // DO NOT CHANGE THE NAME OF THIS FUNCTION WITHOUT ALSO CHANGING
  // THE LINTER RULE IN packages/kbn-eslint-config/typescript.js
  //
  const testSuggestions = Object.assign(_testSuggestionsFn.bind(null, {}), {
    skip: (...args: TestArgs) => {
      return _testSuggestionsFn({ skip: true }, ...args);
    },
    only: (...args: TestArgs) => {
      return _testSuggestionsFn({ only: true }, ...args);
    },
  });

  // const sourceCommands = ['row', 'from', 'show', 'metrics']; Uncomment when metrics is being released
  const sourceCommands = ['row', 'from', 'show'];

  describe('New command', () => {
    const recommendedQuerySuggestions = getRecommendedQueriesSuggestions('FROM logs*', 'dateField');
    testSuggestions('/', [
      ...sourceCommands.map((name) => name.toUpperCase() + ' '),
      ...recommendedQuerySuggestions.map((q) => q.queryString),
    ]);
    const commands = commandDefinitions
      .filter(({ name }) => !sourceCommands.includes(name))
      .map(({ name, types }) => {
        if (types && types.length) {
          const cmds: string[] = [];
          for (const type of types) {
            const cmd = type.name.toUpperCase() + ' ' + name.toUpperCase() + ' ';
            cmds.push(cmd);
          }
          return cmds;
        } else {
          return name.toUpperCase() + ' ';
        }
      })
      .flat();

    testSuggestions('from a | /', commands);
    testSuggestions('from a metadata _id | /', commands);
    testSuggestions('from a | eval var0 = a | /', commands);
    testSuggestions('from a metadata _id | eval var0 = a | /', commands);
  });

  for (const command of ['keep', 'drop']) {
    describe(command, () => {
      testSuggestions(`from a | ${command} /`, getFieldNamesByType('any'));
      testSuggestions(
        `from a | ${command} keywordField, /`,
        getFieldNamesByType('any').filter((name) => name !== 'keywordField')
      );

      testSuggestions(
        `from a | ${command} keywordField,/`,
        getFieldNamesByType('any').filter((name) => name !== 'keywordField'),
        ','
      );

      testSuggestions(
        `from a_index | eval round(doubleField) + 1 | eval \`round(doubleField) + 1\` + 1 | eval \`\`\`round(doubleField) + 1\`\` + 1\` + 1 | eval \`\`\`\`\`\`\`round(doubleField) + 1\`\`\`\` + 1\`\` + 1\` + 1 | eval \`\`\`\`\`\`\`\`\`\`\`\`\`\`\`round(doubleField) + 1\`\`\`\`\`\`\`\` + 1\`\`\`\` + 1\`\` + 1\` + 1 | ${command} /`,
        [
          ...getFieldNamesByType('any'),
          '`round(doubleField) + 1`',
          '```round(doubleField) + 1`` + 1`',
          '```````round(doubleField) + 1```` + 1`` + 1`',
          '```````````````round(doubleField) + 1```````` + 1```` + 1`` + 1`',
          '```````````````````````````````round(doubleField) + 1```````````````` + 1```````` + 1```` + 1`` + 1`',
        ],
        undefined,
        [
          [
            ...fields,
            // the following non-field columns will come over the wire as part of the response
            {
              name: 'round(doubleField) + 1',
              type: 'double',
            },
            {
              name: '`round(doubleField) + 1` + 1',
              type: 'double',
            },
            {
              name: '```round(doubleField) + 1`` + 1` + 1',
              type: 'double',
            },
            {
              name: '```````round(doubleField) + 1```` + 1`` + 1` + 1',
              type: 'double',
            },
            {
              name: '```````````````round(doubleField) + 1```````` + 1```` + 1`` + 1` + 1',
              type: 'double',
            },
          ],
        ]
      );

      it('should not suggest already-used fields and variables', async () => {
        const { suggest: suggestTest } = await setup();
        const getSuggestions = async (query: string, opts?: SuggestOptions) =>
          (await suggestTest(query, opts)).map((value) => value.text);

        expect(
          await getSuggestions('from a_index | EVAL foo = 1 | KEEP /', {
            callbacks: { getColumnsFor: () => [...fields, { name: 'foo', type: 'integer' }] },
          })
        ).toContain('foo');
        expect(
          await getSuggestions('from a_index | EVAL foo = 1 | KEEP foo, /', {
            callbacks: { getColumnsFor: () => [...fields, { name: 'foo', type: 'integer' }] },
          })
        ).not.toContain('foo');

        expect(await getSuggestions('from a_index | KEEP /')).toContain('doubleField');
        expect(await getSuggestions('from a_index | KEEP doubleField, /')).not.toContain(
          'doubleField'
        );
      });
    });
  }

  // @TODO: get updated eval block from main
  describe('values suggestions', () => {
    testSuggestions('FROM "i/"', []);
    testSuggestions('FROM "index/"', []);
    testSuggestions('FROM "  a/"', []);
    testSuggestions('FROM "foo b/"', []);
    testSuggestions('FROM a | WHERE tags == " /"', [], ' ');
    testSuggestions('FROM a | WHERE tags == """ /"""', [], ' ');
    testSuggestions('FROM a | WHERE tags == "a/"', []);
    testSuggestions('FROM a | EVAL tags == " /"', [], ' ');
    testSuggestions('FROM a | EVAL tags == "a"/', []);
    testSuggestions('FROM a | STATS tags == " /"', [], ' ');
    testSuggestions('FROM a | STATS tags == "a/"', []);
    testSuggestions('FROM a | GROK "a/" "%{WORD:firstWord}"', []);
    testSuggestions('FROM a | DISSECT "a/" "%{WORD:firstWord}"', []);
  });

  describe('callbacks', () => {
    it('should send the columns query without the last command', async () => {
      const callbackMocks = createCustomCallbackMocks(undefined, undefined, undefined);
      const statement = 'from a | drop keywordField | eval var0 = abs(doubleField) ';
      const triggerOffset = statement.lastIndexOf(' ');
      const context = createCompletionContext(statement[triggerOffset]);
      await suggest(
        statement,
        triggerOffset + 1,
        context,
        async (text) => (text ? getAstAndSyntaxErrors(text) : { ast: [], errors: [] }),
        callbackMocks
      );
      expect(callbackMocks.getColumnsFor).toHaveBeenCalledWith({
        query: 'from a | drop keywordField',
      });
    });
    it('should send the fields query aware of the location', async () => {
      const callbackMocks = createCustomCallbackMocks(undefined, undefined, undefined);
      const statement = 'from a | drop | eval var0 = abs(doubleField) ';
      const triggerOffset = statement.lastIndexOf('p') + 1; // drop <here>
      const context = createCompletionContext(statement[triggerOffset]);
      await suggest(
        statement,
        triggerOffset + 1,
        context,
        async (text) => (text ? getAstAndSyntaxErrors(text) : { ast: [], errors: [] }),
        callbackMocks
      );
      expect(callbackMocks.getColumnsFor).toHaveBeenCalledWith({ query: 'from a' });
    });
  });

  /**
   * Monaco asks for suggestions in at least two different scenarios.
   * 1. When the user types a non-whitespace character (e.g. 'FROM k') - this is the Invoke trigger kind
   * 2. When the user types a character we've registered as a trigger character (e.g. ',') - this is the Trigger character trigger kind
   *
   * Historically we had good support for the trigger character trigger kind, but not for the Invoke trigger kind. That led
   * to bad experiences like a list of sources not showing up when the user types 'FROM kib'. There they had to delete "kib"
   * and press <space> to trigger suggestions via a trigger character.
   *
   * See https://microsoft.github.io/monaco-editor/typedoc/enums/languages.CompletionTriggerKind.html for more details
   */
  describe('Invoke trigger kind (all commands)', () => {
    // source command
    let recommendedQuerySuggestions = getRecommendedQueriesSuggestions('FROM logs*', 'dateField');
    testSuggestions('f/', [
      ...sourceCommands.map((cmd) => `${cmd.toUpperCase()} `),
      ...recommendedQuerySuggestions.map((q) => q.queryString),
    ]);

    const commands = commandDefinitions
      .filter(({ name }) => !sourceCommands.includes(name))
      .map(({ name, types }) => {
        if (types && types.length) {
          const cmds: string[] = [];
          for (const type of types) {
            const cmd = type.name.toUpperCase() + ' ' + name.toUpperCase() + ' ';
            cmds.push(cmd);
          }
          return cmds;
        } else {
          return name.toUpperCase() + ' ';
        }
      })
      .flat();

    // pipe command
    testSuggestions('FROM k | E/', commands);

    describe('function arguments', () => {
      // function argument
      testSuggestions('FROM kibana_sample_data_logs | EVAL TRIM(e/)', [
        ...getFieldNamesByType(['text', 'keyword']),
        ...getFunctionSignaturesByReturnType(
          Location.EVAL,
          ['text', 'keyword'],
          { scalar: true },
          undefined,
          ['trim']
        ),
      ]);

      // subsequent function argument
      const expectedDateDiff2ndArgSuggestions = [
        TIME_PICKER_SUGGESTION,
        ...TIME_SYSTEM_PARAMS.map((t) => `${t}, `),
        ...getFieldNamesByType(['date', 'date_nanos']).map((name) => `${name}, `),
        ...getFunctionSignaturesByReturnType(Location.EVAL, ['date', 'date_nanos'], {
          scalar: true,
        }).map((s) => ({
          ...s,
          text: `${s.text},`,
        })),
      ];
      testSuggestions('FROM a | EVAL DATE_DIFF("day", /)', expectedDateDiff2ndArgSuggestions);

      // trigger character case for comparison
      testSuggestions('FROM a | EVAL DATE_DIFF("day", /)', expectedDateDiff2ndArgSuggestions, ' ');
    });

    // FROM source
    testSuggestions('FROM k/', ['index1', 'index2'], undefined, [
      ,
      [
        { name: 'index1', hidden: false },
        { name: 'index2', hidden: false },
      ],
    ]);

    // FROM source METADATA
    recommendedQuerySuggestions = getRecommendedQueriesSuggestions('', 'dateField');
    testSuggestions('FROM index1 M/', ['METADATA ']);

    // FROM source METADATA field
    testSuggestions('FROM index1 METADATA _/', METADATA_FIELDS);

    // EVAL argument
    testSuggestions('FROM index1 | EVAL b/', [
      'var0 = ',
      ...getFieldNamesByType('any').map((name) => `${name} `),
      ...getFunctionSignaturesByReturnType(Location.EVAL, 'any', { scalar: true }),
    ]);

    testSuggestions('FROM index1 | EVAL var0 = f/', [
      ...getFieldNamesByType('any').map((name) => `${name} `),
      ...getFunctionSignaturesByReturnType(Location.EVAL, 'any', { scalar: true }),
    ]);

    // DISSECT field
    testSuggestions(
      'FROM index1 | DISSECT b/',
      getFieldNamesByType(ESQL_STRING_TYPES).map((name) => `${name} `)
    );

    // DROP (first field)
    testSuggestions('FROM index1 | DROP f/', getFieldNamesByType('any'));

    // DROP (subsequent field)
    testSuggestions('FROM index1 | DROP field1, f/', getFieldNamesByType('any'));

    // ENRICH policy
    testSuggestions(
      'FROM index1 | ENRICH p/',
      policies.map(({ name }) => getSafeInsertText(name) + ' ')
    );

    // ENRICH policy ON
    testSuggestions('FROM index1 | ENRICH policy O/', ['ON ', 'WITH ', '| ']);

    // ENRICH policy ON field
    testSuggestions(
      'FROM index1 | ENRICH policy ON f/',
      getFieldNamesByType('any').map((name) => `${name} `)
    );

    // ENRICH policy WITH policyfield
    testSuggestions('FROM index1 | ENRICH policy WITH v/', [
      'var0 = ',
      ...getPolicyFields('policy'),
    ]);

    testSuggestions('FROM index1 | ENRICH policy WITH \tv/', [
      'var0 = ',
      ...getPolicyFields('policy'),
    ]);

    // GROK field
    testSuggestions(
      'FROM index1 | GROK f/',
      getFieldNamesByType(ESQL_STRING_TYPES).map((field) => `${field} `),
      undefined
    );

    // KEEP (first field)
    testSuggestions('FROM index1 | KEEP f/', getFieldNamesByType('any'));

    // KEEP (subsequent fields)
    testSuggestions(
      'FROM index1 | KEEP booleanField, f/',
      getFieldNamesByType('any').filter((name) => name !== 'booleanField')
    );

    // LIMIT argument
    testSuggestions('FROM a | LIMIT 1/', ['10 ', '100 ', '1000 ']);

    // MV_EXPAND field
    testSuggestions(
      'FROM index1 | MV_EXPAND f/',
      getFieldNamesByType('any').map((name) => `${name} `)
    );

    // RENAME field
    testSuggestions(
      'FROM index1 | RENAME f/',
      getFieldNamesByType('any').map((name) => `${name} `)
    );

    // RENAME field AS
    testSuggestions('FROM index1 | RENAME field A/', ['AS ']);

    // STATS argument
    testSuggestions('FROM index1 | STATS f/', [
      'var0 = ',
      ...getFunctionSignaturesByReturnType(Location.STATS, 'any', {
        scalar: true,
        agg: true,
        grouping: true,
      }),
    ]);

    // STATS argument BY
    testSuggestions('FROM index1 | STATS AVG(booleanField) B/', ['WHERE ', 'BY ', ', ', '| ']);

    // STATS argument BY expression
    testSuggestions('FROM index1 | STATS field BY f/', [
      'var0 = ',
      getDateHistogramCompletionItem(),
      ...getFunctionSignaturesByReturnType(Location.STATS, 'any', { grouping: true, scalar: true }),
      ...getFieldNamesByType('any').map((field) => `${field} `),
    ]);

    // WHERE argument
    testSuggestions('FROM index1 | WHERE f/', [
      ...getFieldNamesByType('any').map((field) => `${field} `),
      ...getFunctionSignaturesByReturnType(Location.WHERE, 'any', { scalar: true }),
    ]);

    // WHERE argument comparison
    testSuggestions(
      'FROM index1 | WHERE keywordField i/',
      getFunctionSignaturesByReturnType(
        Location.WHERE,
        'boolean',
        {
          operators: true,
        },
        undefined,
        ['and', 'or', 'not']
      )
    );

    // WHERE function <suggest>
    testSuggestions(
      'FROM index1 | WHERE ABS(integerField) i/',
      getFunctionSignaturesByReturnType(
        Location.WHERE,
        'any',
        {
          operators: true,
          skipAssign: true,
        },
        ['integer'],
        ['and', 'or', 'not']
      )
    );
  });

  describe('advancing the cursor and opening the suggestion menu automatically ✨', () => {
    /**
     * NOTE: Monaco uses an Invoke trigger kind when the show suggestions action is triggered (e.g. accepting the "FROM" suggestion)
     */

    const attachAsSnippet = (s: PartialSuggestionWithText): PartialSuggestionWithText => ({
      ...s,
      asSnippet: true,
    });
    let recommendedQuerySuggestions = getRecommendedQueriesSuggestions('FROM logs*', 'dateField');
    // Source command
    testSuggestions('F/', [
      ...['FROM ', 'ROW ', 'SHOW '].map(attachTriggerCommand),
      ...recommendedQuerySuggestions.map((q) => q.queryString),
    ]);

    const commands = commandDefinitions
      .filter(({ name }) => !sourceCommands.includes(name))
      .map(({ name, types }) => {
        if (types && types.length) {
          const cmds: string[] = [];
          for (const type of types) {
            const cmd = type.name.toUpperCase() + ' ' + name.toUpperCase() + ' ';
            cmds.push(cmd);
          }
          return cmds;
        } else {
          return name.toUpperCase() + ' ';
        }
      })
      .flat();

    // Pipe command
    testSuggestions(
      'FROM a | E/',
      commands.map((name) => attachTriggerCommand(name))
    );

    describe('function arguments', () => {
      // literalSuggestions parameter
      const dateDiffFirstParamSuggestions =
        scalarFunctionDefinitions.find(({ name }) => name === 'date_diff')?.signatures[0]
          .params?.[0].literalSuggestions ?? [];
      testSuggestions(
        'FROM a | EVAL DATE_DIFF(/)',
        dateDiffFirstParamSuggestions.map((s) => `"${s}", `).map(attachTriggerCommand)
      );

      // field parameter

      const expectedStringSuggestionsWhenMoreArgsAreNeeded = [
        ...getFieldNamesByType(ESQL_STRING_TYPES)
          .map((field) => `${field}, `)
          .map(attachTriggerCommand),
        ...getFunctionSignaturesByReturnType(
          Location.EVAL,
          ESQL_STRING_TYPES,
          { scalar: true },
          undefined,
          ['replace']
        ).map((s) => ({
          ...s,
          text: `${s.text},`,
        })),
      ];

      testSuggestions('FROM a | EVAL REPLACE(/)', expectedStringSuggestionsWhenMoreArgsAreNeeded);

      // subsequent parameter
      testSuggestions(
        'FROM a | EVAL REPLACE(keywordField, /)',
        expectedStringSuggestionsWhenMoreArgsAreNeeded
      );

      // final parameter — should not advance!
      testSuggestions('FROM a | EVAL REPLACE(keywordField, keywordField, /)', [
        ...getFieldNamesByType(ESQL_STRING_TYPES).map((field) => ({
          text: field,
          command: undefined,
        })),
        ...getFunctionSignaturesByReturnType(
          Location.EVAL,
          ESQL_STRING_TYPES,
          { scalar: true },
          undefined,
          ['replace']
        ),
      ]);

      // Trigger character because this is how it will actually be... the user will press
      // space-bar... this may change if we fix the tokenization of timespan literals
      // such that "2 days" is a single monaco token
      testSuggestions(
        'FROM a | EVAL DATE_TRUNC(2 /)',
        [...timeUnitsToSuggest.map((s) => `${s.name}, `).map(attachTriggerCommand), ','],
        ' '
      );
    });

    recommendedQuerySuggestions = getRecommendedQueriesSuggestions('', 'dateField');

    // PIPE (|)
    testSuggestions('FROM a /', [
      attachTriggerCommand('| '),
      ',',
      attachTriggerCommand('METADATA '),
      ...recommendedQuerySuggestions.map((q) => q.queryString),
    ]);

    // Assignment
    testSuggestions(`FROM a | ENRICH policy on b with /`, [
      attachTriggerCommand('var0 = '),
      ...getPolicyFields('policy'),
    ]);

    // FROM source
    describe('sources', () => {
      testSuggestions(
        'FROM /',
        [
          { text: 'index1', command: TRIGGER_SUGGESTION_COMMAND },
          { text: 'index2', command: TRIGGER_SUGGESTION_COMMAND },
        ],
        undefined,
        [
          ,
          [
            { name: 'index1', hidden: false },
            { name: 'index2', hidden: false },
          ],
        ]
      );

      testSuggestions(
        'FROM index/',
        [
          { text: 'index1', command: TRIGGER_SUGGESTION_COMMAND },
          { text: 'index2', command: TRIGGER_SUGGESTION_COMMAND },
        ],
        undefined,
        [
          ,
          [
            { name: 'index1', hidden: false },
            { name: 'index2', hidden: false },
          ],
        ]
      );
      recommendedQuerySuggestions = getRecommendedQueriesSuggestions('index1', 'dateField');

      testSuggestions(
        'FROM index1/',
        [
          { text: 'index1 | ', filterText: 'index1', command: TRIGGER_SUGGESTION_COMMAND },
          { text: 'index1, ', filterText: 'index1', command: TRIGGER_SUGGESTION_COMMAND },
          { text: 'index1 METADATA ', filterText: 'index1', command: TRIGGER_SUGGESTION_COMMAND },
          ...recommendedQuerySuggestions.map((q) => q.queryString),
        ],
        undefined,
        [
          ,
          [
            { name: 'index1', hidden: false },
            { name: 'index2', hidden: false },
          ],
        ]
      );

      recommendedQuerySuggestions = getRecommendedQueriesSuggestions('index2', 'dateField');
      testSuggestions(
        'FROM index1, index2/',
        [
          { text: 'index2 | ', filterText: 'index2', command: TRIGGER_SUGGESTION_COMMAND },
          { text: 'index2, ', filterText: 'index2', command: TRIGGER_SUGGESTION_COMMAND },
          { text: 'index2 METADATA ', filterText: 'index2', command: TRIGGER_SUGGESTION_COMMAND },
          ...recommendedQuerySuggestions.map((q) => q.queryString),
        ],
        undefined,
        [
          ,
          [
            { name: 'index1', hidden: false },
            { name: 'index2', hidden: false },
          ],
        ]
      );

      // This is a source name that contains a special character
      // meaning that Monaco by default will only set the replacement
      // range to cover "bar" and not "foo$bar". We have to make sure
      // we're setting it ourselves.
      recommendedQuerySuggestions = getRecommendedQueriesSuggestions('foo$bar', 'dateField');
      testSuggestions(
        'FROM foo$bar/',
        [
          {
            text: 'foo$bar | ',
            filterText: 'foo$bar',
            command: TRIGGER_SUGGESTION_COMMAND,
            rangeToReplace: { start: 6, end: 13 },
          },
          {
            text: 'foo$bar, ',
            filterText: 'foo$bar',
            command: TRIGGER_SUGGESTION_COMMAND,
            rangeToReplace: { start: 6, end: 13 },
          },
          {
            text: 'foo$bar METADATA ',
            filterText: 'foo$bar',
            command: TRIGGER_SUGGESTION_COMMAND,
            rangeToReplace: { start: 6, end: 13 },
          },
          ...recommendedQuerySuggestions.map((q) => q.queryString),
        ],
        undefined,
        [, [{ name: 'foo$bar', hidden: false }]]
      );

      // This is an identifier that matches multiple sources
      recommendedQuerySuggestions = getRecommendedQueriesSuggestions('i*', 'dateField');
      testSuggestions(
        'FROM i*/',
        [
          { text: 'i* | ', filterText: 'i*', command: TRIGGER_SUGGESTION_COMMAND },
          { text: 'i*, ', filterText: 'i*', command: TRIGGER_SUGGESTION_COMMAND },
          { text: 'i* METADATA ', filterText: 'i*', command: TRIGGER_SUGGESTION_COMMAND },
          ...recommendedQuerySuggestions.map((q) => q.queryString),
        ],
        undefined,
        [
          ,
          [
            { name: 'index1', hidden: false },
            { name: 'index2', hidden: false },
          ],
        ]
      );
    });

    recommendedQuerySuggestions = getRecommendedQueriesSuggestions('', 'dateField');
    // FROM source METADATA
    testSuggestions('FROM index1 M/', [attachTriggerCommand('METADATA ')]);

    describe('ENRICH', () => {
      testSuggestions(
        'FROM a | ENRICH /',
        policies.map((p) => `${getSafeInsertText(p.name)} `).map(attachTriggerCommand)
      );
      testSuggestions(
        'FROM a | ENRICH pol/',
        policies
          .map((p) => `${getSafeInsertText(p.name)} `)
          .map(attachTriggerCommand)
          .map((s) => ({ ...s, rangeToReplace: { start: 17, end: 20 } }))
      );
      testSuggestions('FROM a | ENRICH policy /', ['ON ', 'WITH ', '| '].map(attachTriggerCommand));

      testSuggestions(
        'FROM a | ENRICH policy ON /',
        getFieldNamesByType('any')
          .map((name) => `${name} `)
          .map(attachTriggerCommand)
      );
      testSuggestions(
        'FROM a | ENRICH policy ON @timestamp /',
        ['WITH ', '| '].map(attachTriggerCommand)
      );
      // nothing fancy with this field list
      testSuggestions('FROM a | ENRICH policy ON @timestamp WITH /', [
        'var0 = ',
        ...getPolicyFields('policy'),
      ]);
      describe('replacement range', () => {
        testSuggestions('FROM a | ENRICH policy ON @timestamp WITH othe/', [
          'var0 = ',
          ...getPolicyFields('policy').map((name) => ({
            text: name,
            command: undefined,
            rangeToReplace: { start: 43, end: 47 },
          })),
        ]);
        testSuggestions(
          'FROM a | ENRICH policy ON @timestamp WITH var0 = othe/',
          getPolicyFields('policy').map((name) => ({
            text: name,
            command: undefined,
            rangeToReplace: { start: 50, end: 54 },
          }))
        );
      });
    });

    // LIMIT number
    testSuggestions('FROM a | LIMIT /', ['10 ', '100 ', '1000 '].map(attachTriggerCommand));

    // STATS argument
    testSuggestions(
      'FROM a | STATS /',
      [
        'var0 = ',
        ...getFunctionSignaturesByReturnType(Location.STATS, 'any', {
          scalar: true,
          agg: true,
          grouping: true,
        }).map(attachAsSnippet),
      ].map(attachTriggerCommand)
    );

    // STATS argument BY
    testSuggestions('FROM a | STATS AVG(numberField) /', [
      ', ',
      attachTriggerCommand('WHERE '),
      attachTriggerCommand('BY '),
      attachTriggerCommand('| '),
    ]);

    // STATS argument BY field
    const allByCompatibleFunctions = getFunctionSignaturesByReturnType(
      Location.STATS,
      'any',
      {
        scalar: true,
        grouping: true,
      },
      undefined,
      undefined,
      'by'
    );
    testSuggestions('FROM a | STATS AVG(numberField) BY /', [
      getDateHistogramCompletionItem(),
      attachTriggerCommand('var0 = '),
      ...getFieldNamesByType('any')
        .map((field) => `${field} `)
        .map(attachTriggerCommand),
      ...allByCompatibleFunctions,
    ]);

    // STATS argument BY assignment (checking field suggestions)
    testSuggestions('FROM a | STATS AVG(numberField) BY var0 = /', [
      getDateHistogramCompletionItem(),
      ...getFieldNamesByType('any')
        .map((field) => `${field} `)
        .map(attachTriggerCommand),
      ...allByCompatibleFunctions,
    ]);

    // WHERE argument (field suggestions)
    testSuggestions('FROM a | WHERE /', [
      ...getFieldNamesByType('any')
        .map((field) => `${field} `)
        .map(attachTriggerCommand),
      ...getFunctionSignaturesByReturnType(Location.WHERE, 'any', { scalar: true }).map(
        attachAsSnippet
      ),
    ]);

    // WHERE argument comparison
    testSuggestions(
      'FROM a | WHERE keywordField /',
      getFunctionSignaturesByReturnType(
        Location.WHERE,
        'boolean',
        {
          operators: true,
        },
        ['keyword']
      ).map((s) => (s.text.toLowerCase().includes('null') ? s : attachTriggerCommand(s)))
    );

    describe('field lists', () => {
      describe('METADATA <field>', () => {
        // METADATA field
        testSuggestions('FROM a METADATA /', METADATA_FIELDS.map(attachTriggerCommand));
        testSuggestions('FROM a METADATA _i/', METADATA_FIELDS.map(attachTriggerCommand));
        testSuggestions(
          'FROM a METADATA _id/',
          [
            { filterText: '_id', text: '_id, ' },
            { filterText: '_id', text: '_id | ' },
          ].map(attachTriggerCommand)
        );
        testSuggestions(
          'FROM a METADATA _id, /',
          METADATA_FIELDS.filter((field) => field !== '_id').map(attachTriggerCommand)
        );
        testSuggestions(
          'FROM a METADATA _id, _ignored/',
          [
            { filterText: '_ignored', text: '_ignored, ' },
            { filterText: '_ignored', text: '_ignored | ' },
          ].map(attachTriggerCommand)
        );
        // comma if there's even one more field
        testSuggestions('FROM a METADATA _id, _ignored, _index, _source/', [
          { filterText: '_source', text: '_source | ', command: TRIGGER_SUGGESTION_COMMAND },
          { filterText: '_source', text: '_source, ', command: TRIGGER_SUGGESTION_COMMAND },
        ]);
        // no comma if there are no more fields
        testSuggestions(
          'FROM a METADATA _id, _ignored, _index, _source, _index_mode, _score, _version/',
          [{ filterText: '_version', text: '_version | ', command: TRIGGER_SUGGESTION_COMMAND }]
        );
      });

      describe.each(['KEEP', 'DROP'])('%s <field>', (commandName) => {
        // KEEP field
        testSuggestions(
          `FROM a | ${commandName} /`,
          getFieldNamesByType('any').map(attachTriggerCommand)
        );
        testSuggestions(
          `FROM a | ${commandName} d/`,
          getFieldNamesByType('any')
            .map<PartialSuggestionWithText>((text) => ({
              text,
              rangeToReplace: { start: 15, end: 16 },
            }))
            .map(attachTriggerCommand)
        );
        testSuggestions(
          `FROM a | ${commandName} doubleFiel/`,
          getFieldNamesByType('any').map(attachTriggerCommand)
        );
        testSuggestions(
          `FROM a | ${commandName} doubleField/`,
          ['doubleField, ', 'doubleField | ']
            .map((text) => ({
              text,
              filterText: 'doubleField',
              rangeToReplace: { start: 15, end: 26 },
            }))
            .map(attachTriggerCommand)
        );
        testSuggestions('FROM a | KEEP doubleField /', ['| ', ',']);

        // Let's get funky with the field names
        testSuggestions(
          `FROM a | ${commandName} @timestamp/`,
          ['@timestamp, ', '@timestamp | ']
            .map((text) => ({
              text,
              filterText: '@timestamp',
              rangeToReplace: { start: 15, end: 25 },
            }))
            .map(attachTriggerCommand),
          undefined,
          [
            [
              { name: '@timestamp', type: 'date' },
              { name: 'utc_stamp', type: 'date' },
            ],
          ]
        );
        testSuggestions(
          `FROM a | ${commandName} foo.bar/`,
          ['foo.bar, ', 'foo.bar | ']
            .map((text) => ({
              text,
              filterText: 'foo.bar',
              rangeToReplace: { start: 15, end: 22 },
            }))
            .map(attachTriggerCommand),
          undefined,
          [
            [
              { name: 'foo.bar', type: 'double' },
              { name: 'baz', type: 'date' },
            ],
          ]
        );

        describe('escaped field names', () => {
          testSuggestions(
            `FROM a | ${commandName} \`foo.bar\`/`,
            ['`foo.bar`, ', '`foo.bar` | '],
            undefined,
            [
              [
                { name: 'foo.bar', type: 'double' },
                { name: 'baz', type: 'date' }, // added so that we get a comma suggestion
              ],
            ]
          );
          testSuggestions(
            `FROM a | ${commandName} \`foo\`\`\`\`bar\`\`baz\`/`,
            ['`foo````bar``baz`, ', '`foo````bar``baz` | '],
            undefined,
            [
              [
                { name: 'foo``bar`baz', type: 'double' },
                { name: 'baz', type: 'date' }, // added so that we get a comma suggestion
              ],
            ]
          );
          testSuggestions(`FROM a | ${commandName} \`any#Char$Field\`/`, [
            '`any#Char$Field`, ',
            '`any#Char$Field` | ',
          ]);
          // @todo enable this test when we can use AST to support this case
          testSuggestions.skip(
            `FROM a | ${commandName} \`foo\`.\`bar\`/`,
            ['`foo`.`bar`, ', '`foo`.`bar` | '],
            undefined,
            [[{ name: 'foo.bar', type: 'double' }]]
          );
        });

        // Subsequent fields
        testSuggestions(
          `FROM a | ${commandName} doubleField, dateFiel/`,
          getFieldNamesByType('any')
            .filter((s) => s !== 'doubleField')
            .map(attachTriggerCommand)
        );
        testSuggestions(`FROM a | ${commandName} doubleField, dateField/`, [
          'dateField, ',
          'dateField | ',
        ]);

        // out of fields
        testSuggestions(
          `FROM a | ${commandName} doubleField, dateField/`,
          ['dateField | '],
          undefined,
          [
            [
              { name: 'doubleField', type: 'double' },
              { name: 'dateField', type: 'date' },
            ],
          ]
        );
      });
    });
  });

  describe('Replacement ranges are attached when needed', () => {
    testSuggestions('FROM a | WHERE doubleField IS NOT N/', [
      { text: 'IS NOT NULL', rangeToReplace: { start: 28, end: 36 } },
      { text: 'IS NULL', rangeToReplace: { start: 35, end: 35 } },
      '!= $0',
      '== $0',
      'IN $0',
      'AND $0',
      'NOT',
      'OR $0',
    ]);
    testSuggestions('FROM a | WHERE doubleField IS N/', [
      { text: 'IS NOT NULL', rangeToReplace: { start: 28, end: 32 } },
      { text: 'IS NULL', rangeToReplace: { start: 28, end: 32 } },
      { text: '!= $0', rangeToReplace: { start: 31, end: 31 } },
      '== $0',
      'IN $0',
      'AND $0',
      'NOT',
      'OR $0',
    ]);
    testSuggestions('FROM a | EVAL doubleField IS NOT N/', [
      { text: 'IS NOT NULL', rangeToReplace: { start: 27, end: 35 } },
      'IS NULL',
      '!= $0',
      '== $0',
      'IN $0',
      'AND $0',
      'NOT',
      'OR $0',
    ]);

    describe('dot-separated field names', () => {
      testSuggestions(
        'FROM a | KEEP field.nam/',
        [{ text: 'field.name', rangeToReplace: { start: 15, end: 24 } }],
        undefined,
        [[{ name: 'field.name', type: 'double' }]]
      );
      // multi-line
      testSuggestions(
        'FROM a\n| KEEP field.nam/',
        [{ text: 'field.name', rangeToReplace: { start: 15, end: 24 } }],
        undefined,
        [[{ name: 'field.name', type: 'double' }]]
      );
      // triple separator
      testSuggestions(
        'FROM a\n| KEEP field.name.f/',
        [{ text: 'field.name.foo', rangeToReplace: { start: 15, end: 27 } }],
        undefined,
        [[{ name: 'field.name.foo', type: 'double' }]]
      );
      // whitespace — we can't support this case yet because
      // we are relying on string checking instead of the AST :(
      testSuggestions.skip(
        'FROM a | KEEP field . n/',
        [{ text: 'field . name', rangeToReplace: { start: 15, end: 23 } }],
        undefined,
        [[{ name: 'field.name', type: 'double' }]]
      );
    });
  });
});
