<script>
  import { t } from '../lib/i18n';
  export let sidecarStatus = { code: 'stopped', port: 0 };
  export let version = 'dev';

  let healthz = 'CHECKING...';
  let startTime = Date.now();
  let uptime = '0s';

  $: if (sidecarStatus.code === 'ready' && sidecarStatus.port) checkHealth(sidecarStatus.port);

  async function checkHealth(port) {
    try {
      const resp = await fetch(`http://127.0.0.1:${port}/healthz`, { method: 'HEAD', cache: 'no-store' });
      healthz = resp.ok ? `HTTP/127.0.0.1:${port}/healthz -> 200 OK` : `FAIL: ${resp.status}`;
    } catch (e) { healthz = `ERROR: ${e.message}`; }
  }

  setInterval(() => {
    const s = Math.floor((Date.now() - startTime) / 1000);
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    uptime = h > 0 ? `${h}H ${m}M ${sec}S` : m > 0 ? `${m}M ${sec}S` : `${sec}S`;
  }, 1000);
</script>

<div class="space-y-10" data-collaboration-id="PAGE_STATUS">
  <header class="flex items-center justify-between border-b-4 border-[var(--border-color)] pb-4">
    <h2 class="text-4xl font-black uppercase italic tracking-tighter text-[var(--text-primary)]">{$t('status.title')}</h2>
    <div class="px-4 py-1 border-2 border-[var(--border-color)] font-black text-xs uppercase tracking-widest
      {sidecarStatus.code === 'ready' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'}">
      {sidecarStatus.code === 'ready' ? $t('status.online') : $t('status.offline')}
    </div>
  </header>

  <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
    <div class="card-swiss !p-6">
      <div class="text-[10px] font-black text-[var(--text-muted)] mb-2 uppercase">{$t('status.core_state')}</div>
      <div class="text-xl font-black italic">{sidecarStatus.code.toUpperCase()}</div>
    </div>
    <div class="card-swiss !p-6">
      <div class="text-[10px] font-black text-[var(--text-muted)] mb-2 uppercase">{$t('status.port')}</div>
      <div class="text-xl font-black italic">{sidecarStatus.port ? `:${sidecarStatus.port}` : '—'}</div>
    </div>
    <div class="card-swiss !p-6">
      <div class="text-[10px] font-black text-[var(--text-muted)] mb-2 uppercase">{$t('status.uptime')}</div>
      <div class="text-xl font-black italic">{uptime}</div>
    </div>
    <div class="card-swiss !p-6">
      <div class="text-[10px] font-black text-[var(--text-muted)] mb-2 uppercase">{$t('status.build')}</div>
      <div class="text-xl font-black italic">{version}</div>
    </div>
  </div>

  <div class="card-swiss !p-0 overflow-hidden">
    <div class="px-6 py-3 border-b-2 border-[var(--border-color)] bg-[var(--bg-main)] text-[10px] font-black italic uppercase tracking-widest">
      {$t('status.diagnostic')}
    </div>
    <div class="p-6 flex items-center gap-4">
      <div class="w-3 h-3 border-2 border-[var(--border-color)] {sidecarStatus.code === 'ready' ? 'bg-green-500' : 'bg-red-500'}"></div>
      <div class="font-mono text-xs font-bold text-[var(--text-primary)] uppercase">{healthz}</div>
    </div>
  </div>
</div>
