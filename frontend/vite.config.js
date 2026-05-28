import { execSync, spawn } from 'node:child_process'
import { createViteDebugInspectorPlugin } from '@linhey/react-debug-inspector'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const DESIGN_SYSTEM_STORYBOOK_PORT = 6006
const DESIGN_SYSTEM_STORYBOOK_URL = `http://127.0.0.1:${DESIGN_SYSTEM_STORYBOOK_PORT}`
let storybookProcess = null

function resolveBuildGitHash() {
  if (process.env.VITE_GIT_HASH) {
    return process.env.VITE_GIT_HASH
  }

  try {
    return execSync('git rev-parse --short=12 HEAD', {
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

async function isStorybookReachable() {
  try {
    const response = await fetch(DESIGN_SYSTEM_STORYBOOK_URL, {
      method: 'HEAD',
      signal: AbortSignal.timeout(800),
    })
    return response.ok || response.status < 500
  } catch {
    return false
  }
}

function ensureStorybookProcess() {
  if (storybookProcess && !storybookProcess.killed && storybookProcess.exitCode === null) {
    return
  }

  storybookProcess = spawn('npm', ['run', 'storybook'], {
    cwd: process.cwd(),
    detached: true,
    stdio: 'ignore',
  })
  storybookProcess.unref()
}

function writeJSON(res, statusCode, payload) {
  res.statusCode = statusCode
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.end(JSON.stringify(payload))
}

function writeStorybookOpeningPage(res) {
  res.statusCode = 200
  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  res.end(`<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Opening GetTokens Storybook</title>
    <style>
      body {
        margin: 0;
        display: grid;
        min-height: 100vh;
        place-items: center;
        background: #f4f1ea;
        color: #17130f;
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace;
      }
      main {
        width: min(42rem, calc(100vw - 2rem));
        border: 2px solid #17130f;
        background: #fffaf0;
        padding: 1.5rem;
        box-shadow: 8px 8px 0 #17130f;
      }
      h1 {
        margin: 0 0 0.75rem;
        font-size: 1rem;
        text-transform: uppercase;
      }
      p {
        margin: 0.5rem 0 0;
        font-size: 0.8125rem;
        line-height: 1.6;
      }
      code {
        font-weight: 700;
      }
    </style>
  </head>
  <body>
    <main>
      <h1>正在打开 GetTokens Storybook</h1>
      <p>开发环境会自动启动 Storybook，然后跳转到 <code>${DESIGN_SYSTEM_STORYBOOK_URL}</code>。</p>
      <p id="status">等待 Storybook 就绪...</p>
    </main>
    <script>
      const statusNode = document.getElementById('status');
      async function poll() {
        try {
          const response = await fetch('/__dev/design-system/storybook/status', { cache: 'no-store' });
          const payload = await response.json();
          if (payload.running) {
            window.location.replace(payload.url);
            return;
          }
        } catch {}
        statusNode.textContent = 'Storybook 启动中，请稍候...';
        window.setTimeout(poll, 900);
      }
      poll();
    </script>
  </body>
</html>`)
}

function designSystemStorybookDevBridgePlugin() {
  return {
    name: 'design-system-storybook-dev-bridge',
    configureServer(server) {
      server.middlewares.use('/__dev/design-system/storybook/status', async (_req, res) => {
        writeJSON(res, 200, {
          running: await isStorybookReachable(),
          url: DESIGN_SYSTEM_STORYBOOK_URL,
        })
      })

      server.middlewares.use('/__dev/design-system/storybook/open', async (_req, res) => {
        if (!(await isStorybookReachable())) {
          ensureStorybookProcess()
        }
        writeStorybookOpeningPage(res)
      })
    },
  }
}

// https://vitejs.dev/config/
export default defineConfig(({ command }) => ({
  define: {
    'import.meta.env.VITE_GIT_HASH': JSON.stringify(resolveBuildGitHash()),
  },
  plugins: [
    command === 'serve' ? createViteDebugInspectorPlugin() : null,
    command === 'serve' ? sessionManagementDevBridgePlugin() : null,
    command === 'serve' ? designSystemStorybookDevBridgePlugin() : null,
    react(),
  ].filter(Boolean),
}))
