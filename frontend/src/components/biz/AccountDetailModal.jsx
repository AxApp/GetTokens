import { useEffect, useMemo, useState } from 'react';
import { useI18n } from '../../context/I18nContext.jsx';
import { DownloadAuthFile, GetAuthFileModels } from '../../../wailsjs/go/main/App';

export default function AccountDetailModal({ account, onClose }) {
  const { t } = useI18n();
  const [models, setModels] = useState([]);
  const [loadingModels, setLoadingModels] = useState(false);
  const [rawContent, setRawContent] = useState('');
  const [loadingRaw, setLoadingRaw] = useState(false);
  const [verifyResult, setVerifyResult] = useState('');
  const [verifying, setVerifying] = useState(false);

  const detailFields = useMemo(
    () => [
      [t('common.type'), account.type || '—'],
      [t('accounts.provider'), account.provider || '—'],
      [t('accounts.size'), account.size ? `${account.size} B` : '—'],
      [t('common.status'), account.status || '—'],
      [t('common.enable'), account.disabled ? 'NO' : 'YES'],
      ['REFRESH', account.lastRefresh ? new Date(account.lastRefresh).toLocaleTimeString() : '—'],
    ],
    [account, t]
  );

  useEffect(() => {
    let mounted = true;

    async function loadData() {
      setLoadingModels(true);
      try {
        const response = await GetAuthFileModels(account.name);
        if (mounted) {
          setModels(response || []);
        }
      } catch (error) {
        console.error(error);
      } finally {
        if (mounted) {
          setLoadingModels(false);
        }
      }

      setLoadingRaw(true);
      try {
        const response = await DownloadAuthFile(account.name);
        const binary = atob(response.contentBase64);
        let decoded = new TextDecoder().decode(Uint8Array.from(binary, (char) => char.charCodeAt(0)));
        try {
          decoded = JSON.stringify(JSON.parse(decoded), null, 2);
        } catch {
          // Keep the original content if it is not JSON.
        }
        if (mounted) {
          setRawContent(decoded);
        }
      } catch (error) {
        if (mounted) {
          setRawContent(`READ_ERROR: ${error.message}`);
        }
      } finally {
        if (mounted) {
          setLoadingRaw(false);
        }
      }
    }

    loadData();
    return () => {
      mounted = false;
    };
  }, [account.name]);

  async function verify() {
    setVerifying(true);
    setVerifyResult('VERIFYING...');
    try {
      await GetAuthFileModels(account.name);
      setVerifyResult('✓ VALID');
    } catch (error) {
      console.error(error);
      setVerifyResult('✗ FAILED');
    } finally {
      setVerifying(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-8 backdrop-blur-sm"
      data-collaboration-id="MODAL_ACCOUNT_DETAIL"
      onClick={onClose}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-2xl flex-col border-2 border-[var(--border-color)] bg-[var(--bg-main)] shadow-hard shadow-[var(--shadow-color)]"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="flex items-center justify-between border-b-2 border-[var(--border-color)] bg-[var(--bg-main)] px-6 py-4">
          <div className="flex flex-col">
            <div className="text-[9px] font-black uppercase tracking-[0.2em] text-[var(--text-muted)]">
              Object_Inspection
            </div>
            <h3 className="max-w-[450px] truncate text-sm font-black italic uppercase tracking-tighter text-[var(--text-primary)]">
              {account.name}
            </h3>
          </div>
          <button onClick={onClose} className="btn-swiss !p-1 !shadow-none hover:bg-[var(--bg-surface)]">
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </header>

        <div className="flex-1 space-y-8 overflow-y-auto p-6 selection:bg-[var(--border-color)] selection:text-[var(--bg-main)]">
          <div className="grid grid-cols-3 gap-y-6 border-b-2 border-dashed border-[var(--border-color)] pb-8">
            {detailFields.map(([label, value]) => (
              <div key={label} className="space-y-1">
                <div className="text-[9px] font-black uppercase italic text-[var(--text-muted)]">{label}</div>
                <div className="truncate text-[11px] font-black uppercase text-[var(--text-primary)]">{value}</div>
              </div>
            ))}
          </div>

          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-[9px] font-black uppercase tracking-widest text-[var(--text-muted)]">
                <span className="h-2 w-2 bg-[var(--border-color)]"></span>
                COMPATIBLE_MODELS
              </div>
              {loadingModels ? <span className="animate-pulse text-[9px] font-black">LOADING...</span> : null}
            </div>
            <div className="flex max-h-24 flex-wrap gap-2 overflow-y-auto pr-2">
              {models.length > 0 ? (
                models.map((model, index) => (
                  <span
                    key={`${model.display_name || model.id || model.name || 'model'}-${index}`}
                    className="border border-[var(--border-color)] bg-[var(--bg-surface)] px-2 py-0.5 text-[10px] font-black italic uppercase"
                  >
                    {model.display_name || model.id || model.name}
                  </span>
                ))
              ) : !loadingModels ? (
                <div className="text-[10px] font-bold italic text-[var(--text-muted)]">NO_DATA_AVAILABLE</div>
              ) : null}
            </div>
          </section>

          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-[9px] font-black uppercase tracking-widest text-[var(--text-muted)]">
                <span className="h-2 w-2 bg-[var(--border-color)]"></span>
                RAW_SOURCE_DATA
              </div>
              {loadingRaw ? (
                <span className="animate-pulse text-[9px] font-black text-[var(--text-muted)]">FETCHING_FS...</span>
              ) : null}
            </div>
            <div className="max-h-[300px] overflow-auto whitespace-pre border-2 border-[var(--border-color)] bg-[var(--bg-main)] p-4 font-mono text-[10px] leading-relaxed text-[var(--text-primary)] shadow-inner">
              {rawContent}
            </div>
          </section>
        </div>

        <footer className="flex items-center justify-between border-t-2 border-[var(--border-color)] bg-[var(--bg-surface)] px-6 py-4">
          <div className="flex items-center gap-4">
            <button
              onClick={verify}
              disabled={verifying}
              className="btn-swiss bg-[var(--border-color)] !text-[var(--bg-main)]"
            >
              {verifying ? 'VERIFYING...' : 'VERIFY_ACCOUNT'}
            </button>
            {verifyResult ? (
              <span
                className={`text-[10px] font-black italic ${
                  verifyResult.includes('✓') ? 'text-green-600' : 'text-red-600'
                }`}
              >
                {verifyResult}
              </span>
            ) : null}
          </div>
          <button onClick={onClose} className="btn-swiss">
            {t('common.close')}
          </button>
        </footer>
      </div>
    </div>
  );
}
