/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./.storybook/**/*.{js,ts,jsx,tsx}",
    "./src/**/*.{svelte,js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      borderWidth: {
        'DEFAULT': '2px',
      },
      borderRadius: {
        'none': '0px',
        'gt-xs': 'var(--gt-radius-xs)',
        'gt-sm': 'var(--gt-radius-sm)',
        'gt-md': 'var(--gt-radius-md)',
        'gt-lg': 'var(--gt-radius-lg)',
        'gt-pill': 'var(--gt-radius-pill)',
      },
      boxShadow: {
        'hard-sm': '2px 2px 0px 0px var(--tw-shadow-color)',
        'hard': '4px 4px 0px 0px var(--tw-shadow-color)',
        'hard-lg': '6px 6px 0px 0px var(--tw-shadow-color)',
        'gt-flat': 'var(--gt-elevation-flat)',
        'gt-raised-1': 'var(--gt-elevation-raised-1)',
        'gt-raised-2': 'var(--gt-elevation-raised-2)',
        'gt-raised-3': 'var(--gt-elevation-raised-3)',
      },
      fontFamily: {
        mono: 'var(--gt-font-family-mono)',
        sans: 'var(--gt-font-family-sans)',
      },
      fontSize: {
        '2xs': ['var(--gt-font-size-2xs)', { lineHeight: 'var(--gt-line-height-tight)' }],
        xs: ['var(--gt-font-size-xs)', { lineHeight: 'var(--gt-line-height-tight)' }],
        sm: ['var(--gt-font-size-lg)', { lineHeight: 'var(--gt-line-height-body)' }],
        base: ['var(--gt-font-size-2xl)', { lineHeight: 'var(--gt-line-height-body)' }],
        lg: ['var(--gt-font-size-3xl)', { lineHeight: 'var(--gt-line-height-body)' }],
        xl: ['var(--gt-font-size-4xl)', { lineHeight: 'var(--gt-line-height-tight)' }],
        '2xl': ['var(--gt-font-size-5xl)', { lineHeight: 'var(--gt-line-height-tight)' }],
        '3xl': ['var(--gt-font-size-6xl)', { lineHeight: 'var(--gt-line-height-tight)' }],
        '4xl': ['var(--gt-font-size-display)', { lineHeight: 'var(--gt-line-height-tight)' }],
      },
      colors: {
        bg: {
          main: 'var(--gt-surface-canvas)',
          surface: 'var(--gt-surface-panel)',
          muted: 'var(--gt-surface-muted)',
        },
        text: {
          primary: 'var(--gt-ink-primary)',
          muted: 'var(--gt-ink-muted)',
          secondary: 'var(--gt-ink-secondary)',
        },
        status: {
          success: 'var(--color-status-success)',
          warning: 'var(--color-status-warning)',
          danger: 'var(--color-status-danger)',
        },
        chart: {
          primary: 'var(--color-chart-primary)',
          secondary: 'var(--color-chart-secondary)',
          blue: 'var(--color-chart-blue)',
          peak: 'var(--color-chart-peak)',
          attribution: 'var(--color-chart-attribution)',
        },
      }
    },
  },
  plugins: [],
}
