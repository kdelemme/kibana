/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

export const convertEquationToPainless = (
  bucketsPath: Record<string, string>,
  equation: string
): string => {
  const workingEquation = equation || Object.keys(bucketsPath).join(' + ');
  return Object.keys(bucketsPath).reduce((acc, key) => {
    return acc.replaceAll(key, `params.${key}`);
  }, workingEquation);
};
