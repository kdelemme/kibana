/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { IRouter, KibanaRequest, type IKibanaResponse } from '@kbn/core/server';
import { transformError } from '@kbn/securitysolution-es-utils';
import { asyncForEach } from '@kbn/std';
import { Client } from 'langsmith';
import { evaluate } from 'langsmith/evaluation';
import { v4 as uuidv4 } from 'uuid';

import { getRequestAbortedSignal } from '@kbn/data-plugin/server';
import { getPrompt } from '@kbn/security-ai-prompts';
import {
  API_VERSIONS,
  newContentReferencesStore,
  ELASTIC_AI_ASSISTANT_EVALUATE_URL,
  ExecuteConnectorRequestBody,
  INTERNAL_API_ACCESS,
  PostEvaluateBody,
  PostEvaluateResponse,
} from '@kbn/elastic-assistant-common';
import { buildRouteValidationWithZod } from '@kbn/elastic-assistant-common/impl/schemas/common';
import { getDefaultArguments } from '@kbn/langchain/server';
import { StructuredTool } from '@langchain/core/tools';
import { AgentFinish } from 'langchain/agents';
import { omit } from 'lodash/fp';
import { localToolPrompts, promptGroupId as toolsGroupId } from '../../lib/prompt/tool_prompts';
import { promptGroupId } from '../../lib/prompt/local_prompt_object';
import { getFormattedTime, getModelOrOss } from '../../lib/prompt/helpers';
import { getAttackDiscoveryPrompts } from '../../lib/attack_discovery/graphs/default_attack_discovery_graph/nodes/helpers/prompts';
import { formatPrompt } from '../../lib/langchain/graphs/default_assistant_graph/prompts';
import { getPrompt as localGetPrompt, promptDictionary } from '../../lib/prompt';
import { buildResponse } from '../../lib/build_response';
import { AssistantDataClients } from '../../lib/langchain/executors/types';
import { AssistantToolParams, ElasticAssistantRequestHandlerContext, GetElser } from '../../types';
import { DEFAULT_PLUGIN_NAME, performChecks } from '../helpers';
import { fetchLangSmithDataset } from './utils';
import { transformESSearchToAnonymizationFields } from '../../ai_assistant_data_clients/anonymization_fields/helpers';
import { EsAnonymizationFieldsSchema } from '../../ai_assistant_data_clients/anonymization_fields/types';
import { evaluateAttackDiscovery } from '../../lib/attack_discovery/evaluation';
import {
  DefaultAssistantGraph,
  getDefaultAssistantGraph,
} from '../../lib/langchain/graphs/default_assistant_graph/graph';
import { getLlmClass, getLlmType, isOpenSourceModel } from '../utils';
import { getGraphsFromNames } from './get_graphs_from_names';
import { DEFAULT_DATE_FORMAT_TZ } from '../../../common/constants';
import { agentRunableFactory } from '../../lib/langchain/graphs/default_assistant_graph/agentRunnable';

const DEFAULT_SIZE = 20;
const ROUTE_HANDLER_TIMEOUT = 10 * 60 * 1000; // 10 * 60 seconds = 10 minutes
const LANG_CHAIN_TIMEOUT = ROUTE_HANDLER_TIMEOUT - 10_000; // 9 minutes 50 seconds
const CONNECTOR_TIMEOUT = LANG_CHAIN_TIMEOUT - 10_000; // 9 minutes 40 seconds

export const postEvaluateRoute = (
  router: IRouter<ElasticAssistantRequestHandlerContext>,
  getElser: GetElser
) => {
  router.versioned
    .post({
      access: INTERNAL_API_ACCESS,
      path: ELASTIC_AI_ASSISTANT_EVALUATE_URL,
      security: {
        authz: {
          requiredPrivileges: ['elasticAssistant'],
        },
      },
      options: {
        timeout: {
          idleSocket: ROUTE_HANDLER_TIMEOUT,
        },
      },
    })
    .addVersion(
      {
        version: API_VERSIONS.internal.v1,
        validate: {
          request: {
            body: buildRouteValidationWithZod(PostEvaluateBody),
          },
          response: {
            200: {
              body: { custom: buildRouteValidationWithZod(PostEvaluateResponse) },
            },
          },
        },
      },
      async (context, request, response): Promise<IKibanaResponse<PostEvaluateResponse>> => {
        const ctx = await context.resolve(['core', 'elasticAssistant', 'licensing']);
        const assistantContext = ctx.elasticAssistant;
        const actions = ctx.elasticAssistant.actions;
        const logger = assistantContext.logger.get('evaluate');
        const abortSignal = getRequestAbortedSignal(request.events.aborted$);
        const savedObjectsClient = ctx.elasticAssistant.savedObjectsClient;

        // Perform license, authenticated user and evaluation FF checks
        const checkResponse = await performChecks({
          capability: 'assistantModelEvaluation',
          context: ctx,
          request,
          response,
        });
        if (!checkResponse.isSuccess) {
          return checkResponse.response;
        }

        try {
          const evaluationId = uuidv4();
          const {
            alertsIndexPattern,
            datasetName,
            evaluatorConnectorId,
            graphs: graphNames,
            langSmithApiKey,
            langSmithProject,
            connectorIds,
            size,
            replacements,
            runName = evaluationId,
          } = request.body;

          const dataset = await fetchLangSmithDataset(datasetName, logger, langSmithApiKey);

          if (dataset.length === 0) {
            return response.badRequest({
              body: { message: `No LangSmith dataset found for name: ${datasetName}` },
            });
          }

          logger.info('postEvaluateRoute:');
          logger.info(`request.query:\n${JSON.stringify(request.query, null, 2)}`);
          logger.info(
            `request.body:\n${JSON.stringify(omit(['langSmithApiKey'], request.body), null, 2)}`
          );
          logger.info(`Evaluation ID: ${evaluationId}`);

          const totalExecutions = connectorIds.length * graphNames.length * dataset.length;
          logger.info('Creating graphs:');
          logger.info(`\tconnectors/models: ${connectorIds.length}`);
          logger.info(`\tgraphs: ${graphNames.length}`);
          logger.info(`\tdataset: ${dataset.length}`);
          logger.warn(`\ttotal graph executions: ${totalExecutions} `);
          if (totalExecutions > 50) {
            logger.warn(
              `Total baseline graph executions >= 50! This may take a while, and cost some money...`
            );
          }

          // Setup graph params
          // Get a scoped esClient for esStore + writing results to the output index
          const esClient = ctx.core.elasticsearch.client.asCurrentUser;

          const inference = ctx.elasticAssistant.inference;
          const productDocsAvailable =
            (await ctx.elasticAssistant.llmTasks.retrieveDocumentationAvailable()) ?? false;

          // Data clients
          const anonymizationFieldsDataClient =
            (await assistantContext.getAIAssistantAnonymizationFieldsDataClient()) ?? undefined;
          const conversationsDataClient =
            (await assistantContext.getAIAssistantConversationsDataClient()) ?? undefined;
          const kbDataClient =
            (await assistantContext.getAIAssistantKnowledgeBaseDataClient()) ?? undefined;
          const dataClients: AssistantDataClients = {
            anonymizationFieldsDataClient,
            conversationsDataClient,
            kbDataClient,
          };

          // Actions
          const actionsClient = await actions.getActionsClientWithRequest(request);
          const connectors = await actionsClient.getBulk({
            ids: connectorIds,
            throwIfSystemAction: false,
          });
          const connectorsWithPrompts = await Promise.all(
            connectors.map(async (connector) => {
              const prompts = await getAttackDiscoveryPrompts({
                actionsClient,
                connectorId: connector.id,
                connector,
                savedObjectsClient,
              });
              return {
                ...connector,
                prompts,
              };
            })
          );

          // Fetch any tools registered to the security assistant
          const assistantTools = assistantContext.getRegisteredTools(DEFAULT_PLUGIN_NAME);

          const { attackDiscoveryGraphs } = getGraphsFromNames(graphNames);

          if (attackDiscoveryGraphs.length > 0) {
            try {
              // NOTE: we don't wait for the evaluation to finish here, because
              // the client will retry / timeout when evaluations take too long
              void evaluateAttackDiscovery({
                actionsClient,
                alertsIndexPattern,
                attackDiscoveryGraphs,
                connectors: connectorsWithPrompts,
                connectorTimeout: CONNECTOR_TIMEOUT,
                datasetName,
                esClient,
                evaluationId,
                evaluatorConnectorId,
                langSmithApiKey,
                langSmithProject,
                logger,
                runName,
                size,
              });
            } catch (err) {
              logger.error(() => `Error evaluating attack discovery: ${err}`);
            }

            // Return early if we're only running attack discovery graphs
            return response.ok({
              body: { evaluationId, success: true },
            });
          }

          const graphs: Array<{
            name: string;
            graph: DefaultAssistantGraph;
            llmType: string | undefined;
            isOssModel: boolean | undefined;
            connectorId: string;
          }> = await Promise.all(
            connectors.map(async (connector) => {
              const llmType = getLlmType(connector.actionTypeId);
              const isOssModel = isOpenSourceModel(connector);
              const isOpenAI = llmType === 'openai' && !isOssModel;
              const llmClass = getLlmClass(llmType);
              const createLlmInstance = () =>
                new llmClass({
                  actionsClient,
                  connectorId: connector.id,
                  llmType,
                  logger,
                  temperature: getDefaultArguments(llmType).temperature,
                  signal: abortSignal,
                  streaming: false,
                  maxRetries: 0,
                  convertSystemMessageToHumanContent: false,
                });
              const llm = createLlmInstance();
              const anonymizationFieldsRes =
                await dataClients?.anonymizationFieldsDataClient?.findDocuments<EsAnonymizationFieldsSchema>(
                  {
                    perPage: 1000,
                    page: 1,
                  }
                );

              const anonymizationFields = anonymizationFieldsRes
                ? transformESSearchToAnonymizationFields(anonymizationFieldsRes.data)
                : undefined;

              // Check if KB is available
              const isEnabledKnowledgeBase =
                (await dataClients.kbDataClient?.isInferenceEndpointExists()) ?? false;

              // Skeleton request from route to pass to the agents
              // params will be passed to the actions executor
              const skeletonRequest: KibanaRequest<unknown, unknown, ExecuteConnectorRequestBody> =
                {
                  ...request,
                  body: {
                    alertsIndexPattern: '',
                    allow: [],
                    allowReplacement: [],
                    subAction: 'invokeAI',
                    // The actionTypeId is irrelevant when used with the invokeAI subaction
                    actionTypeId: '.gen-ai',
                    replacements: {},
                    size: DEFAULT_SIZE,
                    conversationId: '',
                  },
                };

              const contentReferencesStore = newContentReferencesStore();

              // Fetch any applicable tools that the source plugin may have registered
              const assistantToolParams: AssistantToolParams = {
                anonymizationFields,
                esClient,
                isEnabledKnowledgeBase,
                kbDataClient: dataClients?.kbDataClient,
                llm,
                isOssModel,
                logger,
                request: skeletonRequest,
                alertsIndexPattern,
                // onNewReplacements,
                replacements,
                contentReferencesStore,
                inference,
                connectorId: connector.id,
                size,
                telemetry: ctx.elasticAssistant.telemetry,
                ...(productDocsAvailable ? { llmTasks: ctx.elasticAssistant.llmTasks } : {}),
              };

              const tools: StructuredTool[] = (
                await Promise.all(
                  assistantTools.map(async (tool) => {
                    let description: string | undefined;
                    try {
                      description = await getPrompt({
                        actionsClient,
                        connector,
                        connectorId: connector.id,
                        model: getModelOrOss(llmType, isOssModel),
                        localPrompts: localToolPrompts,
                        promptId: tool.name,
                        promptGroupId: toolsGroupId,
                        provider: llmType,
                        savedObjectsClient,
                      });
                    } catch (e) {
                      logger.error(`Failed to get prompt for tool: ${tool.name}`);
                    }
                    return tool.getTool({
                      ...assistantToolParams,
                      llm: createLlmInstance(),
                      isOssModel,
                      description,
                    });
                  })
                )
              ).filter((e) => e != null) as StructuredTool[];

              const defaultSystemPrompt = await localGetPrompt({
                actionsClient,
                connector,
                connectorId: connector.id,
                model: getModelOrOss(llmType, isOssModel),
                promptGroupId: promptGroupId.aiAssistant,
                promptId: promptDictionary.systemPrompt,
                provider: llmType,
                savedObjectsClient,
              });

              const chatPromptTemplate = formatPrompt({
                prompt: defaultSystemPrompt,
                llmType,
                isOpenAI,
              });

              const agentRunnable = await agentRunableFactory({
                llm: createLlmInstance(),
                isOpenAI,
                llmType,
                tools,
                isStream: false,
                prompt: chatPromptTemplate,
              });

              const uiSettingsDateFormatTimezone = await ctx.core.uiSettings.client.get<string>(
                DEFAULT_DATE_FORMAT_TZ
              );

              return {
                connectorId: connector.id,
                name: `${runName} - ${connector.name}`,
                llmType,
                isOssModel,
                graph: getDefaultAssistantGraph({
                  agentRunnable,
                  dataClients,
                  createLlmInstance,
                  logger,
                  actionsClient,
                  savedObjectsClient,
                  tools,
                  replacements: {},
                  getFormattedTime: () =>
                    getFormattedTime({
                      screenContextTimezone: request.body.screenContext?.timeZone,
                      uiSettingsDateFormatTimezone,
                    }),
                }),
              };
            })
          );

          // Run an evaluation for each graph so they show up separately (resulting in each dataset run grouped by connector)
          await asyncForEach(graphs, async ({ name, graph, llmType, isOssModel, connectorId }) => {
            // Wrapper function for invoking the graph (to parse different input/output formats)
            const predict = async (input: { input: string }) => {
              logger.debug(`input:\n ${JSON.stringify(input, null, 2)}`);

              const result = await graph.invoke(
                {
                  input: input.input,
                  connectorId,
                  conversationId: undefined,
                  responseLanguage: 'English',
                  llmType,
                  isStream: false,
                  isOssModel,
                }, // TODO: Update to use the correct input format per dataset type
                {
                  runName,
                  tags: ['evaluation'],
                }
              );
              const output = (result.agentOutcome as AgentFinish).returnValues.output;
              return output;
            };

            evaluate(predict, {
              data: datasetName ?? '',
              evaluators: [], // Evals to be managed in LangSmith for now
              experimentPrefix: name,
              client: new Client({ apiKey: langSmithApiKey }),
              // prevent rate limiting and unexpected multiple experiment runs
              maxConcurrency: 5,
            })
              .then((output) => {
                logger.debug(`runResp:\n ${JSON.stringify(output, null, 2)}`);
              })
              .catch((err) => {
                logger.error(`evaluation error:\n ${JSON.stringify(err, null, 2)}`);
              });
          });

          return response.ok({
            body: { evaluationId, success: true },
          });
        } catch (err) {
          logger.error(err);
          const error = transformError(err);

          const resp = buildResponse(response);
          return resp.error({
            body: { success: false, error: error.message },
            statusCode: error.statusCode,
          });
        }
      }
    );
};
