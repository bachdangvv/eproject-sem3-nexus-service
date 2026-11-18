import { defineTheme } from '@astryxdesign/core/theme';
import { neutralTheme } from '@astryxdesign/theme-neutral/built';
import { vercelIconRegistry } from './vercelIcons.mjs';

export const vercelTheme = defineTheme({
  name: 'vercel',
  extends: neutralTheme,
  icons: vercelIconRegistry,

  typography: {
    scale: { base: 14, ratio: 1.2 },
    body: {
      family: 'Geist',
      fallbacks: "'Inter', ui-sans-serif, system-ui, sans-serif",
      weight: 'normal',
    },
    heading: {
      family: 'Geist',
      fallbacks: "'Inter', ui-sans-serif, system-ui, sans-serif",
      weight: '450',
      weights: {
        1: '450',
        2: '450',
        3: '500',
        4: '500',
        5: '500',
        6: '500',
      },
    },
    code: {
      family: 'Geist Mono',
      fallbacks: "'JetBrains Mono', ui-monospace, monospace",
    },
  },

  radius: { base: 4, multiplier: 0.75 },

  motion: { fast: 125, medium: 280, slow: 650, ratio: 0.75 },

  tokens: {
    // Surfaces — paper canvas (#fafafa / #0a0a0a) & elevated surfaces (#ffffff / #111111)
    '--color-background-body': ['#fafafa', '#0a0a0a'],
    '--color-background-surface': ['#ffffff', '#111111'],
    '--color-background-card': ['#ffffff', '#111111'],
    '--color-background-popover': ['#ffffff', '#111111'],
    '--color-background-muted': ['#f4f4f5', '#171717'],
    '--color-background-inverted': ['#171717', '#ededed'],

    // Hairline borders
    '--color-border': ['#ebebeb', '#262626'],
    '--color-border-emphasized': ['#c9c9c9', '#3a3a3a'],

    // Primary obsidian accent & interactive fill
    '--color-accent': ['#171717', '#ededed'],
    '--color-on-accent': ['#ffffff', '#0a0a0a'],
    '--color-accent-muted': ['rgba(23, 23, 23, 0.08)', 'rgba(237, 237, 237, 0.14)'],
    '--color-text-accent': ['#171717', '#ededed'],
    '--color-icon-accent': ['#171717', '#ededed'],

    // Neutral & overlays
    '--color-neutral': ['rgba(0, 0, 0, 0.04)', 'rgba(255, 255, 255, 0.07)'],
    '--color-overlay': ['rgba(0, 0, 0, 0.48)', 'rgba(0, 0, 0, 0.75)'],
    '--color-overlay-hover': ['rgba(0, 0, 0, 0.04)', 'rgba(255, 255, 255, 0.06)'],
    '--color-overlay-pressed': ['rgba(0, 0, 0, 0.08)', 'rgba(255, 255, 255, 0.12)'],
    '--color-skeleton': ['#ebebeb', '#262626'],
    '--color-track': ['#ebebeb', '#262626'],
    '--color-shadow': ['rgba(0, 0, 0, 0.08)', 'rgba(0, 0, 0, 0.45)'],
    '--color-tint-hover': ['#000000', '#ffffff'],

    // Monochrome typographic scale
    '--color-text-primary': ['#171717', '#ededed'],
    '--color-text-secondary': ['#4d4d4d', '#a3a3a3'],
    '--color-text-disabled': ['#a8a8a8', '#525252'],
    '--color-on-dark': '#ededed',
    '--color-on-light': '#171717',

    '--color-icon-primary': ['#171717', '#ededed'],
    '--color-icon-secondary': ['#666666', '#8f8f8f'],
    '--color-icon-disabled': ['#a8a8a8', '#525252'],

    // Terminal green success highlight
    '--color-success': ['#297a3a', '#3fb950'],
    '--color-on-success': ['#ffffff', '#0a0a0a'],
    '--color-success-muted': ['rgba(41, 122, 58, 0.10)', 'rgba(63, 185, 80, 0.16)'],
    '--color-text-success': ['#297a3a', '#3fb950'],
    '--color-icon-success': ['#297a3a', '#3fb950'],
    '--color-border-success': ['#297a3a', '#3fb950'],
    '--color-on-success-muted': ['#297a3a', '#3fb950'],
    '--color-background-green': ['rgba(41, 122, 58, 0.10)', 'rgba(63, 185, 80, 0.16)'],
    '--color-border-green': ['#297a3a', '#3fb950'],
    '--color-icon-green': ['#297a3a', '#3fb950'],
    '--color-text-green': ['#297a3a', '#3fb950'],

    // Explicit font-family stacks matching Geist + Geist Mono
    '--font-family-body': "'Geist', 'Inter', ui-sans-serif, system-ui, sans-serif",
    '--font-family-heading': "'Geist', 'Inter', ui-sans-serif, system-ui, sans-serif",
    '--font-family-code': "'Geist Mono', 'JetBrains Mono', ui-monospace, monospace",

    // Sharp 6px container & element radii
    '--radius-none': '0px',
    '--radius-inner': '4px',
    '--radius-element': '6px',
    '--radius-container': '6px',
    '--radius-page': '8px',
    '--radius-chat': '8px',
    '--radius-full': '9999px',

    // Subtle hairline ring elevation (no heavy drop shadows)
    '--shadow-low':
      '0 0 0 1px light-dark(rgba(0, 0, 0, 0.08), #262626), 0 0 0 2px light-dark(#fafafa, #0a0a0a)',
    '--shadow-med':
      '0 0 0 1px light-dark(rgba(0, 0, 0, 0.08), #262626), 0 2px 8px light-dark(rgba(0, 0, 0, 0.04), rgba(0, 0, 0, 0.4))',
    '--shadow-high':
      '0 0 0 1px light-dark(rgba(0, 0, 0, 0.10), #333333), 0 8px 24px light-dark(rgba(0, 0, 0, 0.06), rgba(0, 0, 0, 0.55))',
  },

  components: {
    'app-shell-header': {
      'variant:wash': {
        backgroundColor: 'light-dark(rgba(250, 250, 250, 0.85), rgba(10, 10, 10, 0.85))',
        backdropFilter: 'blur(20px)',
      },
    },
    'top-nav': {
      base: {
        minHeight: '64px',
      },
    },
    'top-nav-heading': {
      base: {
        fontWeight: '500',
        letterSpacing: '-0.02em',
      },
    },
    'top-nav-item': {
      base: {
        color: 'var(--color-text-secondary)',
      },
      selected: {
        backgroundColor: 'transparent',
        color: 'var(--color-text-primary)',
        fontWeight: '500',
      },
    },
    'side-nav-item': {
      base: {
        borderRadius: '6px',
        color: 'var(--color-text-secondary)',
      },
      selected: {
        color: 'var(--color-text-primary)',
        fontWeight: '500',
      },
    },
    heading: {
      'level:1': {
        letterSpacing: '-0.04em',
      },
      'level:2': {
        letterSpacing: '-0.03em',
      },
      'level:3': {
        letterSpacing: '-0.02em',
      },
      'type:display-1': {
        fontSize: 'clamp(42px, 4.8vw, 60px)',
        fontWeight: '450',
        letterSpacing: '-0.055em',
        lineHeight: '1.02',
      },
      'type:display-2': {
        fontSize: 'clamp(30px, 3.3vw, 42px)',
        fontWeight: '450',
        letterSpacing: '-0.045em',
        lineHeight: '1.08',
      },
      'type:display-3': {
        fontWeight: '450',
        letterSpacing: '-0.04em',
        lineHeight: '1.15',
      },
    },
    text: {
      'type:supporting': {
        '--color-text-secondary': 'light-dark(#666666, #8f8f8f)',
      },
      'type:eyebrow': {
        fontFamily: 'var(--font-family-code)',
        fontSize: '11px',
        fontWeight: '400',
        lineHeight: '1.85',
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
      },
      'type:glyph': {
        fontFamily: 'var(--font-family-heading)',
        fontSize: 'clamp(132px, 14vw, 184px)',
        fontWeight: '400',
        lineHeight: '0.88',
        color: 'light-dark(#000000, #ededed)',
        userSelect: 'none',
        filter: 'drop-shadow(0 22px 26px light-dark(rgba(0, 0, 0, 0.22), rgba(255, 255, 255, 0.08)))',
      },
      'type:wordmark': {
        fontFamily: 'var(--font-family-heading)',
        fontSize: '15px',
        fontWeight: '600',
        letterSpacing: '-0.025em',
        color: 'light-dark(#404040, #a3a3a3)',
      },
      'type:display-1': {
        fontWeight: '450',
        letterSpacing: '-0.055em',
        lineHeight: '1.02',
      },
      'type:display-2': {
        fontWeight: '450',
        letterSpacing: '-0.045em',
        lineHeight: '1.08',
      },
      'type:display-3': {
        fontWeight: '450',
        letterSpacing: '-0.04em',
        lineHeight: '1.15',
      },
    },
    card: {
      base: {
        borderRadius: '6px',
      },
      'variant:default': {
        borderColor: 'light-dark(rgba(0, 0, 0, 0.08), #262626)',
        boxShadow: '0 0 0 1px light-dark(#fafafa, #0a0a0a)',
      },
    },
    button: {
      base: {
        borderRadius: '6px',
        fontWeight: '500',
        flexShrink: '0',
        whiteSpace: 'nowrap',
      },
      'variant:secondary': {
        backgroundColor: 'var(--color-background-card)',
        borderWidth: '1px',
        borderStyle: 'solid',
        borderColor: 'var(--color-border)',
        color: 'var(--color-text-primary)',
      },
      'variant:ghost': {
        color: 'var(--color-text-secondary)',
        ':hover': {
          color: 'var(--color-text-primary)',
        },
      },
    },
    code: {
      base: {
        fontFamily: 'var(--font-family-code)',
        borderRadius: '4px',
        borderWidth: '1px',
        borderStyle: 'solid',
        borderColor: 'var(--color-border)',
        whiteSpace: 'nowrap',
      },
    },
    'segmented-control': {
      base: {
        borderRadius: '6px',
        padding: 'var(--spacing-1)',
        backgroundColor: 'var(--color-background-muted)',
        borderWidth: '1px',
        borderStyle: 'solid',
        borderColor: 'var(--color-border)',
      },
    },
    'segmented-control-item': {
      base: {
        borderRadius: '4px',
      },
      selected: {
        backgroundColor: 'var(--color-background-card)',
        color: 'var(--color-text-primary)',
        boxShadow: '0 0 0 1px light-dark(rgba(0, 0, 0, 0.08), #262626)',
      },
    },
  },
});
