import { createViteDebugInspectorPlugin } from '@linhey/react-debug-inspector'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import {
  loadSessionManagementDetail,
  loadSessionManagementSnapshot,
} from './dev/sessionManagementDevData.js'

function sessionManagementDevBridgePlugin() {
  return {
    name: 'session-management-dev-bridge',
    configureServer(server) {
      server.middlewares.use('/__dev/session-management/snapshot', async (_req, res) => {
        try {
          const payload = await loadSessionManagementSnapshot()
          res.setHeader('Content-Type', 'application/json; charset=utf-8')
          res.end(JSON.stringify(payload))
        } catch (error) {
          res.statusCode = 500
          res.setHeader('Content-Type', 'application/json; charset=utf-8')
          res.end(JSON.stringify({ error: error instanceof Error ? error.message : 'snapshot load failed' }))
        }
      })

      server.middlewares.use('/__dev/session-management/detail', async (req, res) => {
        try {
          const url = new URL(req.url || '', 'http://127.0.0.1')
          const sessionID = url.searchParams.get('sessionID') || ''
          const payload = await loadSessionManagementDetail(sessionID)
          res.setHeader('Content-Type', 'application/json; charset=utf-8')
          res.end(JSON.stringify(payload))
        } catch (error) {
          res.statusCode = 500
          res.setHeader('Content-Type', 'application/json; charset=utf-8')
          res.end(JSON.stringify({ error: error instanceof Error ? error.message : 'detail load failed' }))
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
