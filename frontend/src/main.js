// main.js — GetTokens frontend entry point
// Communicates with the Go backend via Wails runtime (window.go.*)

const { GetSidecarStatus, GetVersion, CheckUpdate, ApplyUpdate } = window.go?.main?.App ?? {}

// ── DOM refs ──────────────────────────────────────────────────────────────
const splash        = document.getElementById('splash')
const splashMsg     = document.getElementById('splash-msg')
const mainScreen    = document.getElementById('main')
const statusBadge   = document.getElementById('status-badge')
const statStatus    = document.getElementById('stat-status')
const statPort      = document.getElementById('stat-port')
const statUptime    = document.getElementById('stat-uptime')
const statVersion   = document.getElementById('stat-version')
const clientVersion = document.getElementById('client-version')
const healthzResult = document.getElementById('healthz-result')
const updateBanner  = document.getElementById('update-banner')
const updateVersion = document.getElementById('update-version')
const updateInfo    = document.getElementById('update-info')
const btnCheckUpdate  = document.getElementById('btn-check-update')
const btnApplyUpdate  = document.getElementById('btn-apply-update')
const btnDismissUpdate = document.getElementById('btn-dismiss-update')

// ── State ────────────────────────────────────────────────────────────────
let startTime = null
let uptimeTimer = null
let pendingRelease = null

// ── Init ─────────────────────────────────────────────────────────────────
async function init() {
  // Show version
  try {
    const v = await GetVersion()
    if (clientVersion) clientVersion.textContent = v
    if (statVersion) statVersion.textContent = v
  } catch {}

  // Listen for sidecar status events from Go
  if (window.runtime?.EventsOn) {
    window.runtime.EventsOn('sidecar:status', onSidecarStatus)
    window.runtime.EventsOn('updater:available', onUpdateAvailable)
  }

  // Fetch initial status (handles case where backend was already running)
  try {
    const status = await GetSidecarStatus()
    onSidecarStatus(status)
  } catch {}
}

// ── Sidecar status handler ────────────────────────────────────────────────
function onSidecarStatus(status) {
  const { code, port, message } = status ?? {}

  // Update splash message while starting
  if (code === 'starting') {
    if (splashMsg) splashMsg.textContent = message || '正在启动后端服务…'
    showSplash()
    return
  }

  if (code === 'ready') {
    startTime = startTime ?? Date.now()
    showMain()
    setBadge('ready', '运行中')
    if (statStatus) statStatus.textContent = '运行中'
    if (statPort) statPort.textContent = port ? `:${port}` : '—'
    startUptimeTimer()
    checkHealthz(port)
    return
  }

  if (code === 'error') {
    showMain()
    setBadge('error', '错误')
    if (statStatus) statStatus.textContent = message || '发生错误'
    setHealthzBox('error', message || '后端启动失败')
    return
  }

  if (code === 'stopped') {
    setBadge('stopped', '已停止')
    if (statStatus) statStatus.textContent = '已停止'
    stopUptimeTimer()
  }
}

// ── Health check ──────────────────────────────────────────────────────────
async function checkHealthz(port) {
  if (!port) return
  try {
    const resp = await fetch(`http://127.0.0.1:${port}/healthz`, { method: 'HEAD', cache: 'no-store' })
    if (resp.ok) {
      setHealthzBox('ok', `http://127.0.0.1:${port}/healthz → 200 OK`)
    } else {
      setHealthzBox('error', `healthz 返回 ${resp.status}`)
    }
  } catch (e) {
    setHealthzBox('error', `无法连接: ${e.message}`)
  }
}

function setHealthzBox(state, text) {
  if (!healthzResult) return
  const dot = healthzResult.querySelector('.dot')
  if (dot) {
    dot.className = 'dot'
    dot.classList.add(state === 'ok' ? 'dot-ok' : 'dot-error')
  }
  const span = healthzResult.querySelectorAll('span')[1]
  if (span) span.textContent = text
}

// ── Uptime timer ──────────────────────────────────────────────────────────
function startUptimeTimer() {
  stopUptimeTimer()
  uptimeTimer = setInterval(() => {
    if (!startTime || !statUptime) return
    const s = Math.floor((Date.now() - startTime) / 1000)
    const h = Math.floor(s / 3600)
    const m = Math.floor((s % 3600) / 60)
    const sec = s % 60
    statUptime.textContent = h > 0
      ? `${h}h ${m}m ${sec}s`
      : m > 0 ? `${m}m ${sec}s` : `${sec}s`
  }, 1000)
}
function stopUptimeTimer() {
  if (uptimeTimer) { clearInterval(uptimeTimer); uptimeTimer = null }
}

// ── Update handlers ───────────────────────────────────────────────────────
function onUpdateAvailable(release) {
  if (!release) return
  pendingRelease = release
  if (updateVersion) updateVersion.textContent = release.version
  if (updateBanner) updateBanner.classList.remove('hidden')
}

btnCheckUpdate?.addEventListener('click', async () => {
  btnCheckUpdate.textContent = '检查中…'
  btnCheckUpdate.disabled = true
  try {
    const release = await CheckUpdate()
    if (release) {
      if (updateInfo) {
        updateInfo.innerHTML = `
          <strong>发现新版本 ${release.version}</strong><br/>
          <small style="color:var(--text2)">${release.releaseNote?.slice(0, 200) || ''}…</small>
        `
        updateInfo.classList.remove('hidden')
      }
      onUpdateAvailable(release)
    } else {
      if (updateInfo) {
        updateInfo.textContent = '✓ 已是最新版本'
        updateInfo.classList.remove('hidden')
      }
    }
  } catch (e) {
    if (updateInfo) {
      updateInfo.textContent = `检查失败: ${e}`
      updateInfo.classList.remove('hidden')
    }
  } finally {
    btnCheckUpdate.textContent = '检查更新'
    btnCheckUpdate.disabled = false
  }
})

btnApplyUpdate?.addEventListener('click', async () => {
  if (!pendingRelease) return
  btnApplyUpdate.textContent = '下载中…'
  btnApplyUpdate.disabled = true
  try {
    await ApplyUpdate()
    alert('更新完成，请重启应用。')
  } catch (e) {
    alert(`更新失败: ${e}`)
    btnApplyUpdate.textContent = '立即更新'
    btnApplyUpdate.disabled = false
  }
})

btnDismissUpdate?.addEventListener('click', () => {
  if (updateBanner) updateBanner.classList.add('hidden')
})

// ── Navigation ────────────────────────────────────────────────────────────
document.querySelectorAll('.nav-item').forEach(item => {
  item.addEventListener('click', e => {
    e.preventDefault()
    const page = item.dataset.page
    document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'))
    item.classList.add('active')
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'))
    const target = document.getElementById(`page-${page}`)
    if (target) target.classList.add('active')
  })
})

// ── Screen helpers ────────────────────────────────────────────────────────
function showSplash() {
  splash?.classList.add('active')
  mainScreen?.classList.remove('active')
}
function showMain() {
  splash?.classList.remove('active')
  mainScreen?.classList.add('active')
}
function setBadge(type, label) {
  if (!statusBadge) return
  statusBadge.className = `badge badge-${type}`
  statusBadge.textContent = label
}

// ── Boot ──────────────────────────────────────────────────────────────────
// Wait for Wails runtime to be injected, then init.
function waitForWails(retries = 20) {
  if (window.go?.main?.App || retries <= 0) {
    init()
  } else {
    setTimeout(() => waitForWails(retries - 1), 100)
  }
}
waitForWails()
