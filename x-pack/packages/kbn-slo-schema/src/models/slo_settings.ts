/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import * as t from 'io-ts';
import { sloSettingsStoredSchema } from '../schema/slo_settings';

type SLOSettingsStored = t.OutputOf<typeof sloSettingsStoredSchema>;

export type { SLOSettingsStored };
