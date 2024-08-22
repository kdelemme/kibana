/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { InvestigationItemType, InvestigationItems } from '@kbn/investigation-shared';
import { GlobalWidgetParameters } from '../../common/types';

type ItemDefinitionGenerateData = Record<string, any>;

// type `data` somehow
export interface ItemDefinition {
  type: InvestigationItemType;
  generate: (option: {
    item: InvestigationItems;
    params: GlobalWidgetParameters;
  }) => Promise<ItemDefinitionGenerateData>;
  render: (option: {
    data: ItemDefinitionGenerateData;
    item: InvestigationItems;
  }) => React.ReactNode;
}

export class ItemDefinitionRegistry {
  private readonly definitions: ItemDefinition[] = [];

  constructor() {}

  public registerItem(definition: ItemDefinition) {
    this.definitions.push(definition);
  }

  public getItemDefinitions(): ItemDefinition[] {
    return this.definitions;
  }

  public getItemDefinitionByType(type: InvestigationItemType): ItemDefinition | undefined {
    return this.definitions.find((definition) => definition.type === type);
  }
}
