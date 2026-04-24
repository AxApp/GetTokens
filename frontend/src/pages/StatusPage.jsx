import { useEffect, useRef, useState } from 'react';
import { useI18n } from '../context/I18nContext.jsx';

export default function StatusPage({ sidecarStatus = { code: 'stopped', port: 0 }, version = 'dev' }) {
  const { t } = useI18n();
  const startTimeRef = useRef(Date.now());
  const [healthz, setHealthz] = useState('CHECKING...');
  const [uptime, setUptime] = useState('0s');

  useEffect(() => {
    const timer = window.setInterval(() => {
      const seconds = Math.floor((Date.now() - startTimeRef.current) / 1000);
      const hours = Math.floor(seconds / 3600);
      const minutes = Math.floor((seconds % 3600) / 60);
      const remainingSeconds = seconds % 60;

      if (hours > 0) {
        setUptime(`${hours}H ${minutes}M ${remainingSeconds}S`);
      } else if (minutes > 0) {
        setUptime(`${minutes}M ${remainingSeconds}S`);
      } else {
        setUptime(`${remainingSeconds}S`);
      }
    }, 1000);

    return () => {
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function checkHealth() {
      if (sidecarStatus.code !== 'ready' || !sidecarStatus.port) {
        setHealthz('CHECKING...');
        return;
      }

      try {
        const response = await fetch(`http://127.0.0.1:${sidecarStatus.port}/healthz`, {
          method: 'HEAD',
          cache: 'no-store',
        });
        if (!cancelled) {
          setHealthz(
            response.ok
              ? `HTTP/127.0.0.1:${sidecarStatus.port}/healthz -> 200 OK`
              : `FAIL: ${response.status}`
          );
        }
      } catch (error) {
        if (!cancelled) {
          setHealthz(`ERROR: ${error.message}`);
        }
      }
    }

    checkHealth();

    return () => {
      cancelled = true;
    };
  }, [sidecarStatus.code, sidecarStatus.port]);

  return (
    <div className="h-full w-full overflow-auto p-12" data-collaboration-id="PAGE_STATUS">
      <div className="mx-auto max-w-6xl space-y-10">
        <header className="flex items-center justify-between border-b-4 border-[var(--border-color)] pb-4">
          <h2 className="text-4xl font-black uppercase italic tracking-tighter text-[var(--text-primary)]">
            {t('status.title')}
          </h2>
          <div
            className={`px-4 py-1 text-xs font-black uppercase tracking-widest text-white border-2 border-[var(--border-color)] ${
              sidecarStatus.code === 'ready' ? 'bg-green-600' : 'bg-red-600'
            }`}
          >
            {sidecarStatus.code === 'ready' ? t('status.online') : t('status.offline')}
          </div>
        </header>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
          <div className="card-swiss !p-6">
            <div className="mb-2 text-[10px] font-black uppercase text-[var(--text-muted)]">
              {t('status.core_state')}
            </div>
            <div className="text-xl font-black italic">{sidecarStatus.code.toUpperCase()}</div>
          </div>
          <div className="card-swiss !p-6">
            <div className="mb-2 text-[10px] font-black uppercase text-[var(--text-muted)]">
              {t('status.port')}
            </div>
            <div className="text-xl font-black italic">
              {sidecarStatus.port ? `:${sidecarStatus.port}` : '—'}
            </div>
          </div>
          <div className="card-swiss !p-6">
            <div className="mb-2 text-[10px] font-black uppercase text-[var(--text-muted)]">
              {t('status.uptime')}
            </div>
            <div className="text-xl font-black italic">{uptime}</div>
          </div>
          <div className="card-swiss !p-6">
            <div className="mb-2 text-[10px] font-black uppercase text-[var(--text-muted)]">
              {t('status.build')}
            </div>
            <div className="text-xl font-black italic">{version}</div>
          </div>
        </div>

        <div className="card-swiss !p-0 overflow-hidden">
          <div className="border-b-2 border-[var(--border-color)] bg-[var(--bg-main)] px-6 py-3 text-[10px] font-black italic uppercase tracking-widest">
            {t('status.diagnostic')}
          </div>
          <div className="flex items-center gap-4 p-6">
            <div
              className={`h-3 w-3 border-2 border-[var(--border-color)] ${
                sidecarStatus.code === 'ready' ? 'bg-green-500' : 'bg-red-500'
              }`}
            ></div>
            <div className="font-mono text-xs font-bold uppercase text-[var(--text-primary)]">{healthz}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
