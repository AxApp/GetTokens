import { createViteDebugInspectorPlugin } from '@linhey/react-debug-inspector'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import {
  loadSessionManagementDetail,
  loadSessionManagementSnapshot,
} from './dev/sessionManagementDevData.js'

function sessionManagementDevBridgePlugin() {
  function writeJSON(res, statusCode, payload) {
    res.statusCode = statusCode
    res.setHeader('Content-Type', 'application/json; charset=utf-8')
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.end(JSON.stringify(payload))
  }

  return {
    name: 'session-management-dev-bridge',
    configureServer(server) {
      server.middlewares.use('/__dev/session-management/snapshot', async (req, res) => {
        try {
          const url = new URL(req.url || '', 'http://127.0.0.1')
          const forceRefresh = url.searchParams.get('refresh') === '1'
          const payload = await loadSessionManagementSnapshot({ forceRefresh })
          writeJSON(res, 200, payload)
        } catch (error) {
          writeJSON(res, 500, { error: error instanceof Error ? error.message : 'snapshot load failed' })
        }
      })

      server.middlewares.use('/__dev/session-management/detail', async (req, res) => {
        try {
          const url = new URL(req.url || '', 'http://127.0.0.1')
          const sessionID = url.searchParams.get('sessionID') || ''
          const payload = await loadSessionManagementDetail(sessionID)
          writeJSON(res, 200, payload)
        } catch (error) {
          writeJSON(res, 500, { error: error instanceof Error ? error.message : 'detail load failed' })
        }
      })
    },
  }
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    createViteDebugInspectorPlugin(),
    sessionManagementDevBridgePlugin(),
    react(),
  ],
})
