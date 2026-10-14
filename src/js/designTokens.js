/**
 * Centralized Design Token Library for Peoria Gaussian Splat Desktopscape Engine.
 * Exports standard design system primitive variables for brand colors,
 * component height variants, and uniform padding utilities.
 */

export const DESIGN_TOKENS = {
  colors: {
    brandPrimary: '#38ef7d',
    brandPrimaryHover: '#2cd06c',
    brandPrimaryActive: '#22b15a',
    brandSecondary: '#11998e',
    brandAccent: '#f2994a',
    bgDark: 'rgba(12, 17, 28, 0.82)',
    bgCard: 'rgba(22, 30, 46, 0.75)',
    textMain: '#f0f4f8',
    textMuted: '#94a3b8',
    borderGlass: 'rgba(255, 255, 255, 0.12)',
    shadowGlow: '0 8px 32px 0 rgba(0, 0, 0, 0.45)',
    colorError: '#f87171',
    colorErrorBg: 'rgba(239, 68, 68, 0.2)',
    colorSuccess: '#34d399',
    colorSuccessBg: 'rgba(16, 185, 129, 0.2)',
    colorWarning: '#fbbf24',
    colorWarningBg: 'rgba(245, 158, 11, 0.2)'
  },
  heights: {
    sm: '32px',
    md: '40px',
    lg: '48px',
    buttonSm: '32px',
    buttonMd: '40px',
    buttonLg: '48px',
    inputMd: '40px'
  },
  padding: {
    xs: '4px 8px',
    sm: '8px 12px',
    md: '12px 16px',
    lg: '16px 20px',
    xl: '20px 24px',
    card: '16px 20px',
    input: '10px 12px',
    button: '10px 16px'
  },
  radii: {
    sm: '6px',
    md: '8px',
    lg: '12px',
    xl: '16px',
    full: '9999px'
  }
};
