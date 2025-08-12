/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { useEffect, useState } from 'react';
import { useFormContext } from 'react-hook-form';
import type { CreateSLOForm } from '../types';
import { useSectionFormValidation } from './use_section_form_validation';

export function useShowSections(isEditMode: boolean) {
  const { formState } = useFormContext<CreateSLOForm>();
  const { isIndicatorSectionValid, isObjectiveSectionValid } = useSectionFormValidation();
  const [showDescriptionSection, setShowDescriptionSection] = useState<boolean>(isEditMode);
  const [showObjectiveSection, setShowObjectiveSection] = useState<boolean>(isEditMode);

  const isFormValidating = formState.isValidating;

  useEffect(() => {
    if (!isFormValidating && !showObjectiveSection && isIndicatorSectionValid) {
      setShowObjectiveSection(true);
    }
  }, [showObjectiveSection, isIndicatorSectionValid, isFormValidating]);

  useEffect(() => {
    if (
      !isFormValidating &&
      !showDescriptionSection &&
      isIndicatorSectionValid &&
      isObjectiveSectionValid
    ) {
      setShowDescriptionSection(true);
    }
  }, [showDescriptionSection, isIndicatorSectionValid, isObjectiveSectionValid, isFormValidating]);

  return { showDescriptionSection, showObjectiveSection };
}
