import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    svelte({
      inspector: {
        toggleKeyCombo: 'alt-x',
        showKeyCombo: true,
        holdMode: true,
      }
    })
  ],
})
