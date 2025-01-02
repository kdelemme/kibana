/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { findListsBySize } from '@kbn/securitysolution-list-api';
import { useAsync, withOptionalSignal } from '@kbn/securitysolution-hook-utils';

const findListsBySizeWithOptionalSignal = withOptionalSignal(findListsBySize);

export const useFindListsBySize = () => useAsync(findListsBySizeWithOptionalSignal);
