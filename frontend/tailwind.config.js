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
        'swiss': '2px',
        'none': '0px',
      },
      boxShadow: {
        'hard-sm': '2px 2px 0px 0px var(--tw-shadow-color)',
        'hard': '4px 4px 0px 0px var(--tw-shadow-color)',
        'hard-lg': '6px 6px 0px 0px var(--tw-shadow-color)',
      },
      fontFamily: {
        mono: 'var(--font-family-mono)',
        sans: 'var(--font-family-ui)',
      },
      fontSize: {
        '2xs': ['var(--font-size-ui-2xs)', { lineHeight: 'var(--line-height-ui-tight)' }],
        xs: ['var(--font-size-ui-xs)', { lineHeight: 'var(--line-height-ui-tight)' }],
        sm: ['var(--font-size-ui-lg)', { lineHeight: 'var(--line-height-ui-normal)' }],
        base: ['var(--font-size-ui-2xl)', { lineHeight: 'var(--line-height-ui-normal)' }],
        lg: ['var(--font-size-ui-3xl)', { lineHeight: 'var(--line-height-ui-normal)' }],
        xl: ['var(--font-size-ui-4xl)', { lineHeight: 'var(--line-height-ui-tight)' }],
        '2xl': ['var(--font-size-ui-5xl)', { lineHeight: 'var(--line-height-ui-tight)' }],
        '3xl': ['var(--font-size-ui-6xl)', { lineHeight: 'var(--line-height-ui-tight)' }],
        '4xl': ['var(--font-size-ui-display)', { lineHeight: 'var(--line-height-ui-tight)' }],
      },
      colors: {
        bg: {
          main: 'var(--bg-main)',
          surface: 'var(--bg-surface)',
          muted: 'var(--bg-muted)',
        },
        text: {
          primary: 'var(--text-primary)',
          muted: 'var(--text-muted)',
          secondary: 'var(--text-secondary)',
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
        'swiss': {
          black: 'var(--border-color)',
          white: 'var(--bg-main)',
          gray: {
            50: 'var(--bg-surface)',
            100: 'var(--bg-muted)',
            200: 'var(--shadow-color)',
            300: 'var(--color-swiss-gray-300)',
            400: 'var(--color-swiss-gray-400)',
            500: 'var(--color-swiss-gray-500)',
            600: 'var(--color-swiss-gray-600)',
            700: 'var(--color-swiss-gray-700)',
            800: 'var(--color-swiss-gray-800)',
            900: 'var(--color-swiss-gray-900)',
            950: 'var(--color-swiss-gray-950)',
          }
        }
      }
    },
  },
  plugins: [],
}
