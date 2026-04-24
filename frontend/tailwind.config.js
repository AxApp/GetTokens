/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
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
      colors: {
        'swiss': {
          black: '#000000',
          white: '#ffffff',
          gray: {
            50: '#f9f9f9',
            100: '#f0f0f0',
            200: '#e5e5e5',
            300: '#d4d4d4',
            400: '#a3a3a3',
            500: '#737373',
            600: '#525252',
            700: '#404040',
            800: '#262626',
            900: '#171717',
            950: '#0a0a0c',
          }
        }
      }
    },
  },
  plugins: [],
}
