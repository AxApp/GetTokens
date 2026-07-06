import { execSync } from 'node:child_process'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { createViteDebugInspectorPlugin } from '@linhey/react-debug-inspector'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const WAILS_GENERATED_RETRY_TIMEOUT_MS = 2000
const WAILS_GENERATED_RETRY_INTERVAL_MS = 50
const WAILS_GENERATED_FILE_EXTENSIONS = new Set(['.js', '.ts'])

function resolveBuildGitHash() {
  if (process.env.VITE_GIT_HASH) {
    return process.env.VITE_GIT_HASH
  }

  try {
    return execSync('git rev-parse HEAD', {
      cwd: process.cwd(),
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim()
  } catch {
    return ''
  }
}

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
      server.middlewares.use('/__dev/session-management/provider-merge', async (req, res) => {
        if (req.method === 'OPTIONS') {
          res.statusCode = 204
          res.setHeader('Access-Control-Allow-Origin', '*')
          res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
          res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
          res.end()
          return
        }
        if (req.method !== 'POST') {
          writeJSON(res, 405, { error: 'method not allowed' })
          return
        }

        try {
          const { updateSessionManagementProviders } = await import('./dev/sessionManagementDevData.js')
          const chunks = []
          for await (const chunk of req) {
            chunks.push(chunk)
          }
          const body = Buffer.concat(chunks).toString('utf8')
          const payload = body ? JSON.parse(body) : {}
          const snapshot = await updateSessionManagementProviders(payload)
          writeJSON(res, 200, snapshot)
        } catch (error) {
          writeJSON(res, 500, { error: error instanceof Error ? error.message : 'provider merge failed' })
        }
      })

      server.middlewares.use('/__dev/session-management/snapshot', async (req, res) => {
        try {
          const url = new URL(req.url || '', 'http://127.0.0.1')
          const workspace = url.searchParams.get('workspace') === 'claude' ? 'claude' : 'codex'
          const forceRefresh = url.searchParams.get('refresh') === '1'
          const {
            loadClaudeSessionManagementSnapshot,
            loadSessionManagementSnapshot,
          } = await import('./dev/sessionManagementDevData.js')
          const payload = workspace === 'claude'
            ? await loadClaudeSessionManagementSnapshot({ forceRefresh })
            : await loadSessionManagementSnapshot({ forceRefresh })
          writeJSON(res, 200, payload)
        } catch (error) {
          writeJSON(res, 500, { error: error instanceof Error ? error.message : 'snapshot load failed' })
        }
      })

      server.middlewares.use('/__dev/session-management/detail', async (req, res) => {
        try {
          const url = new URL(req.url || '', 'http://127.0.0.1')
          const workspace = url.searchParams.get('workspace') === 'claude' ? 'claude' : 'codex'
          const sessionID = url.searchParams.get('sessionID') || ''
          const {
            loadClaudeSessionManagementDetail,
            loadSessionManagementDetail,
          } = await import('./dev/sessionManagementDevData.js')
          const payload = workspace === 'claude'
            ? await loadClaudeSessionManagementDetail(sessionID)
            : await loadSessionManagementDetail(sessionID)
          writeJSON(res, 200, payload)
        } catch (error) {
          writeJSON(res, 500, { error: error instanceof Error ? error.message : 'detail load failed' })
        }
      })

      server.middlewares.use('/__dev/session-management/analysis', async (req, res) => {
        try {
          const url = new URL(req.url || '', 'http://127.0.0.1')
          const { analyzeCodexSessions } = await import('./dev/sessionManagementDevData.js')
          const payload = await analyzeCodexSessions({
            scope: url.searchParams.get('scope') || 'all',
            projectID: url.searchParams.get('projectID') || '',
            sessionIDs: (url.searchParams.get('sessionIDs') || '')
              .split(',')
              .map((item) => item.trim())
              .filter(Boolean),
            limit: Number.parseInt(url.searchParams.get('limit') || '0', 10) || 0,
          })
          writeJSON(res, 200, payload)
        } catch (error) {
          writeJSON(res, 500, { error: error instanceof Error ? error.message : 'analysis failed' })
        }
      })
    },
  }
}

function writeJSON(res, statusCode, payload) {
  res.statusCode = statusCode
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.end(JSON.stringify(payload))
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function isMissingFileError(error) {
  return error && typeof error === 'object' && error.code === 'ENOENT'
}

function cleanViteID(id) {
  return id.split('?')[0]
}

function isWailsGeneratedFileID(id) {
  const filePath = path.normalize(cleanViteID(id))
  const wailsDir = path.join(process.cwd(), 'wailsjs') + path.sep
  return filePath.startsWith(wailsDir) && WAILS_GENERATED_FILE_EXTENSIONS.has(path.extname(filePath))
}

async function readWailsGeneratedFileWithRetry(filePath) {
  const startedAt = Date.now()

  while (true) {
    try {
      return await fs.readFile(filePath, 'utf8')
    } catch (error) {
      if (!isMissingFileError(error) || Date.now() - startedAt >= WAILS_GENERATED_RETRY_TIMEOUT_MS) {
        throw error
      }
      await sleep(WAILS_GENERATED_RETRY_INTERVAL_MS)
    }
  }
}

function wailsGeneratedFileRetryPlugin() {
  return {
    name: 'wails-generated-file-retry',
    enforce: 'pre',
    async load(id) {
      if (!isWailsGeneratedFileID(id)) {
        return null
      }
      return readWailsGeneratedFileWithRetry(cleanViteID(id))
    },
  }
}

// https://vitejs.dev/config/
export default defineConfig(({ command }) => ({
  define: {
    'import.meta.env.VITE_GIT_HASH': JSON.stringify(resolveBuildGitHash()),
  },
  plugins: [
    command === 'serve' ? wailsGeneratedFileRetryPlugin() : null,
    command === 'serve' ? createViteDebugInspectorPlugin() : null,
    command === 'serve' ? sessionManagementDevBridgePlugin() : null,
    react(),
  ].filter(Boolean),
}))
