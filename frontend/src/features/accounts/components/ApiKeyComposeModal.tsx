import { useState } from 'react';
import { Button, Checkbox, Input } from 'antd';
import { Loader2 } from 'lucide-react';
import type { ApiKeyFormState, ClickEventLike, TextInputEvent, Translator } from '../model/types';

const DEFAULT_PROBE_MODEL = 'gpt-5.4-mini';
const apiKeyComposeOverlayClass =
  'fixed inset-0 z-50 flex items-center justify-center bg-[var(--overlay-scrim-80)] p-8';
const apiKeyComposePanelClass =
  'flex max-h-[calc(100vh-4rem)] w-full max-w-xl flex-col overflow-hidden rounded-md border border-[var(--gt-border-subtle)] bg-[var(--gt-surface-canvas)]';
const apiKeyComposeHeaderClass = 'border-b border-[var(--gt-border-subtle)] px-6 py-4';
const apiKeyComposeBodyClass = 'space-y-4 overflow-y-auto p-6';
const apiKeyComposeFooterClass =
  'flex items-center justify-between border-t border-[var(--gt-border-subtle)] bg-[var(--gt-surface-muted)] px-6 py-4';
const apiKeyComposeLabelClass =
  'text-[length:var(--gt-font-size-xs)] font-semibold tracking-normal text-[var(--gt-ink-muted)]';
const apiKeyComposeInputClass =
  'w-full rounded border border-[var(--gt-border-subtle)] bg-[var(--gt-surface-canvas)] px-3 py-2 text-[length:var(--gt-font-size-sm)] font-normal text-[var(--gt-ink-primary)] outline-none transition-colors placeholder:text-[var(--gt-ink-disabled)] focus:border-[var(--gt-ink-primary)] disabled:cursor-not-allowed disabled:opacity-50';
const apiKeyComposeToggleClass =
  'flex items-center gap-2 rounded border border-[var(--gt-border-subtle)] bg-[var(--gt-surface-muted)] px-3 py-2';
const apiKeyComposeProbeClass =
  'space-y-3 rounded border border-[var(--gt-border-subtle)] bg-[var(--gt-surface-muted)] px-4 py-4';
const apiKeyComposeModelChipClass =
  'rounded border px-2 py-0.5 text-[length:var(--gt-font-size-2xs)] font-semibold tracking-normal transition-colors';
const apiKeyComposeModelChipActiveClass =
  'border-[var(--gt-ink-primary)] bg-[var(--gt-ink-primary)] text-[var(--gt-surface-canvas)]';
const apiKeyComposeModelChipInactiveClass =
  'border-[var(--gt-border-subtle)] bg-[var(--gt-surface-canvas)] text-[var(--gt-ink-muted)] hover:border-[var(--gt-ink-primary)]';
const apiKeyComposeErrorClass =
  'rounded border border-[var(--gt-status-danger)] bg-[color-mix(in_srgb,var(--gt-status-danger)_10%,transparent)] px-4 py-3 text-[length:var(--gt-font-size-sm)] font-semibold tracking-normal text-[var(--gt-status-danger)]';
const apiKeyComposeStatusClass = (status: FetchModelsState['status'] | ProbeVerifyState['status']) =>
  `text-[length:var(--gt-font-size-xs)] font-semibold tracking-normal ${
    status === 'success'
      ? 'text-[var(--gt-status-success)]'
      : status === 'error'
        ? 'text-[var(--gt-status-danger)]'
        : 'text-[var(--gt-ink-muted)]'
  }`;

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
    <div className={apiKeyComposeOverlayClass} data-api-key-compose-modal onClick={onClose}>
      <div
        className={apiKeyComposePanelClass}
        onClick={(event: ClickEventLike) => event.stopPropagation()}
      >
        <header className={apiKeyComposeHeaderClass} data-api-key-compose-header>
          <div className={apiKeyComposeLabelClass}>
            {t('accounts.source_api_key')}
          </div>
          <h3 className="mt-1 text-sm font-semibold tracking-normal text-[var(--gt-ink-primary)]">
            {t('accounts.add_codex_api_key')}
          </h3>
        </header>
        <div className={apiKeyComposeBodyClass} data-api-key-compose-body>
          <div className="grid gap-4">
            <label className="space-y-2">
              <span className={apiKeyComposeLabelClass}>
                {t('accounts.api_key_label')}
              </span>
              <Input
                value={form.label}
                onChange={(event: TextInputEvent) => onChange('label', event.target.value)}
                className={apiKeyComposeInputClass}
                placeholder={t('accounts.api_key_label_placeholder')}
              />
            </label>
            <label className="space-y-2">
              <span className={apiKeyComposeLabelClass}>
                {t('accounts.api_key_value')}
              </span>
              <Input.Password
                value={form.apiKey}
                onChange={(event: TextInputEvent) => onChange('apiKey', event.target.value)}
                className={apiKeyComposeInputClass}
                placeholder={t('accounts.api_key_value_placeholder')}
              />
            </label>
            <label className="space-y-2">
              <span className={apiKeyComposeLabelClass}>
                Base URL
              </span>
              <Input
                value={form.baseUrl}
                onChange={(event: TextInputEvent) => onChange('baseUrl', event.target.value)}
                className={apiKeyComposeInputClass}
                placeholder="https://api.openai.com/v1"
              />
            </label>
            <label className={apiKeyComposeToggleClass}>
              <Checkbox
                checked={form.quotaEnabled}
                onChange={(event) => onChange('quotaEnabled', event.target.checked)}
              />
              <span className={apiKeyComposeLabelClass}>
                {t('accounts.quota_curl_enabled')}
              </span>
            </label>
            <label className="space-y-2">
              <span className={apiKeyComposeLabelClass}>
                {t('accounts.quota_curl')}
              </span>
              <Input.TextArea
                size="small"
                value={form.quotaCurl}
                onChange={(event) => onChange('quotaCurl', event.target.value)}
                className="min-h-28 resize-y font-mono"
                placeholder='curl -sS "https://example.com/api/codex/usage" -H "Authorization: Bearer {{apiKey}}"'
              />
            </label>
          </div>

          {showProbeSection ? (
            <div className={apiKeyComposeProbeClass} data-api-key-compose-probe>
              <div className={apiKeyComposeLabelClass}>
                {t('accounts.api_key_probe')}
              </div>

              {onFetchModels ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-3">
                    <Button
                      size="small"
                      onClick={() => void handleFetchModels()}
                      disabled={!probeEnabled || fetchModelsState.status === 'loading'}
                    >
                      {fetchModelsState.status === 'loading' ? (
                        <span className="flex items-center gap-1.5">
                          <Loader2 className="h-3 w-3 animate-spin" />
                          {t('accounts.openai_provider_models_fetch_running')}
                        </span>
                      ) : (
                        t('accounts.openai_provider_models_fetch')
                      )}
                    </Button>
                    {fetchModelsState.status !== 'idle' ? (
                      <span className={apiKeyComposeStatusClass(fetchModelsState.status)}>
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
                        <Button
                          key={name}
                          size="small"
                          onClick={() => setVerifyModel(name)}
                          className={`${apiKeyComposeModelChipClass} ${
                            verifyModel === name
                              ? apiKeyComposeModelChipActiveClass
                              : apiKeyComposeModelChipInactiveClass
                          }`}
                        >
                          {name}
                        </Button>
                      ))}
                      {fetchModelsState.models.length > 12 ? (
                        <span className="self-center text-[length:var(--gt-font-size-2xs)] font-semibold tracking-normal text-[var(--gt-ink-muted)]">
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
                    <Input
                      value={verifyModel}
                      onChange={(e: TextInputEvent) => setVerifyModel(e.target.value)}
                      list="api-key-compose-probe-models"
                      className={`${apiKeyComposeInputClass} min-w-0 flex-1`}
                      placeholder={DEFAULT_PROBE_MODEL}
                    />
                    <Button
                      size="small"
                      onClick={() => void handleVerify()}
                      disabled={!probeEnabled || !verifyModel.trim() || verifyState.status === 'loading'}
                      className="whitespace-nowrap"
                    >
                      {verifyState.status === 'loading' ? (
                        <span className="flex items-center gap-1.5">
                          <Loader2 className="h-3 w-3 animate-spin" />
                          {t('accounts.api_key_verify_running')}
                        </span>
                      ) : (
                        t('accounts.api_key_verify')
                      )}
                    </Button>
                  </div>
                  {verifyState.status !== 'idle' ? (
                    <div className={apiKeyComposeStatusClass(verifyState.status)}>
                      {verifyState.message}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : null}

          {error ? (
            <div className={apiKeyComposeErrorClass}>
              {error}
            </div>
          ) : null}
        </div>
        <footer className={apiKeyComposeFooterClass} data-api-key-compose-footer>
          <Button size="small" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button type="primary" size="small" onClick={onSubmit}>
            {t('accounts.add_codex_api_key')}
          </Button>
        </footer>
      </div>
    </div>
  );
}
