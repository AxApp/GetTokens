import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import type { ApiKeyFormState, ClickEventLike, TextInputEvent, Translator } from '../model/types';

const DEFAULT_PROBE_MODEL = 'gpt-5.4-mini';

interface FetchModelsState {
  status: 'idle' | 'loading' | 'success' | 'error';
  models: string[];
  message: string;
}

interface ProbeVerifyState {
  status: 'idle' | 'loading' | 'success' | 'error';
  message: string;
}

interface ApiKeyComposeModalProps {
  t: Translator;
  form: ApiKeyFormState;
  error: string;
  onClose: () => void;
  onChange: (field: keyof ApiKeyFormState, value: string | boolean) => void;
  onSubmit: () => void;
  onFetchModels?: (input: { baseUrl: string; apiKey: string }) => Promise<{ models: string[]; message: string }>;
  onVerify?: (input: { baseUrl: string; apiKey: string; model: string }) => Promise<{ success: boolean; message: string }>;
  initialFetchModelsState?: FetchModelsState;
  initialVerifyModel?: string;
  initialVerifyState?: ProbeVerifyState;
}

export default function ApiKeyComposeModal({
  t,
  form,
  error,
  onClose,
  onChange,
  onSubmit,
  onFetchModels,
  onVerify,
  initialFetchModelsState,
  initialVerifyModel,
  initialVerifyState,
}: ApiKeyComposeModalProps) {
  const [fetchModelsState, setFetchModelsState] = useState<FetchModelsState>({
    status: initialFetchModelsState?.status ?? 'idle',
    models: initialFetchModelsState?.models ?? [],
    message: initialFetchModelsState?.message ?? '',
  });
  const [verifyModel, setVerifyModel] = useState(initialVerifyModel ?? DEFAULT_PROBE_MODEL);
  const [verifyState, setVerifyState] = useState<ProbeVerifyState>({
    status: initialVerifyState?.status ?? 'idle',
    message: initialVerifyState?.message ?? '',
  });

  const probeEnabled = form.apiKey.trim().length > 0;

  const handleFetchModels = async () => {
    if (!onFetchModels || !probeEnabled) return;
    setFetchModelsState({ status: 'loading', models: [], message: '' });
    try {
      const result = await onFetchModels({ baseUrl: form.baseUrl, apiKey: form.apiKey });
      setFetchModelsState({ status: 'success', models: result.models, message: result.message });
    } catch (err) {
      setFetchModelsState({
        status: 'error',
        models: [],
        message: err instanceof Error ? err.message : String(err),
      });
    }
  };

  const handleVerify = async () => {
    if (!onVerify || !probeEnabled || !verifyModel.trim()) return;
    setVerifyState({ status: 'loading', message: '' });
    try {
      const result = await onVerify({ baseUrl: form.baseUrl, apiKey: form.apiKey, model: verifyModel.trim() });
      setVerifyState({ status: result.success ? 'success' : 'error', message: result.message });
    } catch (err) {
      setVerifyState({
        status: 'error',
        message: err instanceof Error ? err.message : String(err),
      });
    }
  };

  const showProbeSection = Boolean(onFetchModels || onVerify);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-8 backdrop-blur-sm" onClick={onClose}>
      <div
        className="flex w-full max-w-xl flex-col border-2 border-[var(--border-color)] bg-[var(--bg-main)] shadow-hard shadow-[var(--shadow-color)]"
        onClick={(event: ClickEventLike) => event.stopPropagation()}
      >
        <header className="border-b-2 border-[var(--border-color)] px-6 py-4">
          <div className="text-[0.5625rem] font-black uppercase tracking-[0.2em] text-[var(--text-muted)]">
            {t('accounts.source_api_key')}
          </div>
          <h3 className="mt-1 text-sm font-black uppercase italic tracking-tight text-[var(--text-primary)]">
            {t('accounts.add_codex_api_key')}
          </h3>
        </header>
        <div className="space-y-4 overflow-y-auto p-6">
          <div className="grid gap-4">
            <label className="space-y-2">
              <span className="text-[0.5625rem] font-black uppercase tracking-[0.18em] text-[var(--text-muted)]">
                {t('accounts.api_key_label')}
              </span>
              <input
                value={form.label}
                onChange={(event: TextInputEvent) => onChange('label', event.target.value)}
                className="input-swiss w-full"
                placeholder={t('accounts.api_key_label_placeholder')}
              />
            </label>
            <label className="space-y-2">
              <span className="text-[0.5625rem] font-black uppercase tracking-[0.18em] text-[var(--text-muted)]">
                {t('accounts.api_key_value')}
              </span>
              <input
                value={form.apiKey}
                onChange={(event: TextInputEvent) => onChange('apiKey', event.target.value)}
                className="input-swiss w-full"
                placeholder={t('accounts.api_key_value_placeholder')}
                type="password"
              />
            </label>
            <label className="space-y-2">
              <span className="text-[0.5625rem] font-black uppercase tracking-[0.18em] text-[var(--text-muted)]">
                Base URL
              </span>
              <input
                value={form.baseUrl}
                onChange={(event: TextInputEvent) => onChange('baseUrl', event.target.value)}
                className="input-swiss w-full"
                placeholder="https://api.openai.com/v1"
              />
            </label>
            <label className="flex items-center gap-2 border-2 border-[var(--border-color)] bg-[var(--bg-surface)] px-3 py-2">
              <input
                type="checkbox"
                checked={form.quotaEnabled}
                onChange={(event) => onChange('quotaEnabled', event.target.checked)}
              />
              <span className="text-[0.5625rem] font-black uppercase tracking-[0.18em] text-[var(--text-muted)]">
                {t('accounts.quota_curl_enabled')}
              </span>
            </label>
            <label className="space-y-2">
              <span className="text-[0.5625rem] font-black uppercase tracking-[0.18em] text-[var(--text-muted)]">
                {t('accounts.quota_curl')}
              </span>
              <textarea
                value={form.quotaCurl}
                onChange={(event) => onChange('quotaCurl', event.target.value)}
                className="input-swiss min-h-28 w-full resize-y font-mono"
                placeholder='curl -sS "https://example.com/api/codex/usage" -H "Authorization: Bearer {{apiKey}}"'
              />
            </label>
          </div>

          {showProbeSection ? (
            <div className="space-y-3 border-2 border-[var(--border-color)] bg-[var(--bg-surface)]/30 px-4 py-4">
              <div className="text-[0.5625rem] font-black uppercase tracking-[0.2em] text-[var(--text-muted)]">
                {t('accounts.api_key_probe')}
              </div>

              {onFetchModels ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => void handleFetchModels()}
                      disabled={!probeEnabled || fetchModelsState.status === 'loading'}
                      className="btn-swiss !py-1.5 !text-[0.5625rem]"
                    >
                      {fetchModelsState.status === 'loading' ? (
                        <span className="flex items-center gap-1.5">
                          <Loader2 className="h-3 w-3 animate-spin" />
                          {t('accounts.openai_provider_models_fetch_running')}
                        </span>
                      ) : (
                        t('accounts.openai_provider_models_fetch')
                      )}
                    </button>
                    {fetchModelsState.status !== 'idle' ? (
                      <span
                        className={`text-[0.5625rem] font-black uppercase tracking-[0.12em] ${
                          fetchModelsState.status === 'success'
                            ? 'text-green-600'
                            : fetchModelsState.status === 'error'
                              ? 'text-red-500'
                              : 'text-[var(--text-muted)]'
                        }`}
                      >
                        {fetchModelsState.status === 'success'
                          ? fetchModelsState.models.length > 0
                            ? `${fetchModelsState.models.length} models`
                            : t('accounts.api_key_probe_models_none')
                          : fetchModelsState.message}
                      </span>
                    ) : null}
                  </div>
                  {fetchModelsState.status === 'success' && fetchModelsState.models.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {fetchModelsState.models.slice(0, 12).map((name) => (
                        <button
                          key={name}
                          type="button"
                          onClick={() => setVerifyModel(name)}
                          className={`border px-2 py-0.5 text-[0.5rem] font-black uppercase tracking-[0.12em] transition-colors ${
                            verifyModel === name
                              ? 'border-[var(--text-primary)] bg-[var(--text-primary)] text-[var(--bg-main)]'
                              : 'border-[var(--border-color)] text-[var(--text-muted)] hover:border-[var(--text-primary)]'
                          }`}
                        >
                          {name}
                        </button>
                      ))}
                      {fetchModelsState.models.length > 12 ? (
                        <span className="self-center text-[0.5rem] font-black uppercase tracking-[0.12em] text-[var(--text-muted)]">
                          +{fetchModelsState.models.length - 12}
                        </span>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              ) : null}

              {onVerify ? (
                <div className="space-y-2">
                  <datalist id="api-key-compose-probe-models">
                    {fetchModelsState.models.map((name) => (
                      <option key={name} value={name} />
                    ))}
                  </datalist>
                  <div className="flex items-center gap-2">
                    <input
                      value={verifyModel}
                      onChange={(e: TextInputEvent) => setVerifyModel(e.target.value)}
                      list="api-key-compose-probe-models"
                      className="input-swiss min-w-0 flex-1"
                      placeholder={DEFAULT_PROBE_MODEL}
                    />
                    <button
                      type="button"
                      onClick={() => void handleVerify()}
                      disabled={!probeEnabled || !verifyModel.trim() || verifyState.status === 'loading'}
                      className="btn-swiss whitespace-nowrap !py-2 !text-[0.5625rem]"
                    >
                      {verifyState.status === 'loading' ? (
                        <span className="flex items-center gap-1.5">
                          <Loader2 className="h-3 w-3 animate-spin" />
                          {t('accounts.api_key_verify_running')}
                        </span>
                      ) : (
                        t('accounts.api_key_verify')
                      )}
                    </button>
                  </div>
                  {verifyState.status !== 'idle' ? (
                    <div
                      className={`text-[0.5625rem] font-black uppercase tracking-wide ${
                        verifyState.status === 'success'
                          ? 'text-green-600'
                          : verifyState.status === 'error'
                            ? 'text-red-500'
                            : 'text-[var(--text-muted)]'
                      }`}
                    >
                      {verifyState.message}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : null}

          {error ? (
            <div className="border-2 border-red-500 bg-red-500/10 px-4 py-3 text-[0.625rem] font-black uppercase tracking-wide text-red-500">
              {error}
            </div>
          ) : null}
        </div>
        <footer className="flex items-center justify-between border-t-2 border-[var(--border-color)] bg-[var(--bg-surface)] px-6 py-4">
          <button onClick={onClose} className="btn-swiss">
            {t('common.cancel')}
          </button>
          <button onClick={onSubmit} className="btn-swiss bg-[var(--text-primary)] !text-[var(--bg-main)]">
            {t('accounts.add_codex_api_key')}
          </button>
        </footer>
      </div>
    </div>
  );
}
