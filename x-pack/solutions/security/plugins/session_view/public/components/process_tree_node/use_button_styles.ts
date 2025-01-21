/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { useMemo } from 'react';
import { CSSObject } from '@emotion/react';
import { useEuiTheme } from '../../hooks';

export const useButtonStyles = () => {
  const { euiTheme } = useEuiTheme();

  const cached = useMemo(() => {
    const { border, colors, size, font } = euiTheme;

    const button: CSSObject = {
      lineHeight: '18px',
      height: '20px',
      fontSize: size.m,
      fontFamily: font.family,
      fontWeight: font.weight.medium,
      borderRadius: border.radius.small,
      marginLeft: size.xs,
      marginRight: size.xs,
      minWidth: 0,
      padding: `${size.s} ${size.xxs}`,
      color: colors.textPrimary,
      background: colors.backgroundBasePrimary,
      border: `${border.width.thin} solid ${colors.borderBasePrimary}`,
      '&& > span': {
        padding: `0px ${size.xxs}`,
        svg: {
          transition: `transform ${euiTheme.animation.extraFast}`,
        },
      },
      '&&:hover, &&:focus': {
        background: colors.backgroundLightPrimary,
        textDecoration: 'none',
      },
      '&.isExpanded > span svg:not(.alertIcon)': {
        transform: `rotate(180deg)`,
      },
      '&.isExpanded': {
        color: colors.ghost,
        background: colors.backgroundFilledPrimary,
        '&:hover, &:focus': {
          background: colors.backgroundFilledPrimary,
        },
      },
    };

    const buttonArrow: CSSObject = {
      marginLeft: size.xs,
    };
    const alertButton: CSSObject = {
      ...button,
      color: colors.textDanger,
      background: colors.backgroundBaseDanger,
      border: `${border.width.thin} solid ${colors.borderBaseDanger}`,
      '&&:hover, &&:focus': {
        background: colors.backgroundLightDanger,
        textDecoration: 'none',
      },
      '&.isExpanded': {
        color: colors.ghost,
        background: colors.backgroundFilledDanger,
        '&:hover, &:focus': {
          background: `${colors.backgroundFilledDanger}`,
        },
      },

      '& .euiButton__text': {
        display: 'flex',
        alignItems: 'center',
        ' .alertIcon': {
          marginLeft: '4px',
        },
      },
    };

    const outputButton: CSSObject = {
      ...button,
      color: colors.textAccent,
      background: colors.backgroundBaseAccent,
      border: `${border.width.thin} solid ${colors.borderBaseAccent}`,
      '&&:hover, &&:focus': {
        background: colors.backgroundLightAccent,
        textDecoration: 'none',
      },
      '&.isExpanded': {
        color: colors.ghost,
        background: colors.backgroundFilledAccent,
        '&:hover, &:focus': {
          background: `${colors.backgroundFilledAccent}`,
        },
      },
    };

    const userChangedButton: CSSObject = {
      ...button,
      cursor: 'default',
      color: colors.textAccentSecondary,
      background: colors.backgroundBaseAccentSecondary,
      border: `${border.width.thin} solid ${colors.borderBaseAccentSecondary}`,
      '&&:hover, &&:focus': {
        color: colors.textAccentSecondary,
        background: colors.backgroundBaseAccentSecondary,
        textDecoration: 'none',
        transform: 'none',
        animation: 'none',
      },
    };

    const buttonSize: CSSObject = {
      padding: `0px ${euiTheme.size.xs}`,
    };

    return {
      buttonArrow,
      button,
      alertButton,
      outputButton,
      userChangedButton,
      buttonSize,
    };
  }, [euiTheme]);

  return cached;
};
