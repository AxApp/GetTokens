import { useState, type ReactNode } from 'react';
import type { Translator } from '../model/types';
import {
  resolveOpenAICompatibleProviderPreset,
  resolveProviderDetailModelOptions,
  type OpenAICompatibleModelRow,
  type OpenAICompatibleProviderDraft,
  type ProviderRemoteModelsState,
  type ProviderVerifyState,
} from '../model/openAICompatible';
import AccountProxyRouteSection from './AccountProxyRouteSection';
import {
  AccountDetailBody,
  AccountDetailModuleStack,
  AccountDetailNotice,
  AccountDetailSection,
} from './AccountDetailPrimitives';

interface OpenAICompatibleDetailPanelProps {
  t: Translator;
  draft: OpenAICompatibleProviderDraft;
  verifyState: ProviderVerifyState;
  remoteModelsState?: ProviderRemoteModelsState;
  error: string;
  saving: boolean;
  footerMessage?: string;
  onClose: () => void;
  onChange: (next: OpenAICompatibleProviderDraft) => void;
  onSave: () => void | Promise<void>;
  onVerify: () => void;
  onFetchModels: () => void;
  onApplyFetchedModels: () => void;
  leadingSections?: ReactNode;
  afterSections?: ReactNode;
}

function formatLastVerifiedAt(timestamp: number | null) {
  if (!timestamp) {
    return '—';
  }
  return new Date(timestamp).toLocaleString();
}

export default function OpenAICompatibleDetailPanel({
  t,
  draft,
  verifyState,
  remoteModelsState,
  error,
  saving,
  footerMessage,
  onClose,
  onChange,
  onSave,
  onVerify,
  onFetchModels,
  onApplyFetchedModels,
  leadingSections,
  afterSections,
}: OpenAICompatibleDetailPanelProps) {
  const [headersExpanded, setHeadersExpanded] = useState(false);
  const [proxyRouteError, setProxyRouteError] = useState('');
  const selectedPreset = resolveOpenAICompatibleProviderPreset({
    name: draft.name,
    baseUrl: draft.baseUrl,
  });
  const suggestedModelOptions = resolveProviderDetailModelOptions({
    draft,
    remoteModelsState,
  });
  const suggestedModels: OpenAICompatibleModelRow[] = suggestedModelOptions.models;
  const effectiveVerifyModel = draft.verifyModel || suggestedModels[0]?.name || '';
  const modelSourceLabel =
    suggestedModelOptions.source === 'remote'
      ? t('accounts.openai_provider_models_source_remote')
      : suggestedModelOptions.source === 'local'
        ? t('accounts.openai_provider_models_source_local')
        : suggestedModelOptions.source === 'preset'
          ? t('accounts.openai_provider_models_source_preset')
          : t('accounts.openai_provider_models_source_empty');

  const messageTone =
    verifyState.status === 'success'
      ? 'text-[var(--color-status-success)]'
      : verifyState.status === 'error'
        ? 'text-[var(--color-status-danger)]'
        : 'text-[var(--text-muted)]';

  return (
    <>
      <header className="shrink-0 border-b-2 border-[var(--border-color)] px-6 py-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 flex-1 space-y-2">
            <div className="text-[length:var(--font-size-ui-xs)] font-black uppercase tracking-[0.2em] text-[var(--text-muted)]">
              {t('accounts.ui_openai_account_badge')}
            </div>
            <div className="space-y-3">
              <h3 className="text-[length:var(--font-size-ui-md)] font-black uppercase italic tracking-[0.08em] text-[var(--text-primary)]">
                {t('accounts.openai_provider_name')}
              </h3>
              <input
                value={draft.name}
                onChange={(event) => onChange({ ...draft, name: event.target.value })}
                className="input-swiss w-full max-w-xl"
                placeholder={selectedPreset?.id || 'deepseek'}
              />
            </div>
          </div>

          <div className="w-full max-w-sm space-y-2 border border-[var(--border-color)] bg-[var(--bg-surface)] px-4 py-3">
            <div className="flex items-center justify-between gap-3">
              <div className="text-[length:var(--font-size-ui-2xs)] font-black uppercase tracking-[0.22em] text-[var(--text-muted)]">
                {t('accounts.openai_provider_test_summary')}
              </div>
              <div className="text-[length:var(--font-size-ui-2xs)] font-black uppercase tracking-[0.16em] text-[var(--text-muted)]">
                {verifyState.model || '—'}
              </div>
            </div>
            <div className={`text-[length:var(--font-size-ui-sm)] font-black uppercase tracking-tight ${messageTone}`}>
              {verifyState.message || t('accounts.openai_provider_test_idle')}
            </div>
            <div className="flex items-center justify-between gap-4 text-[length:var(--font-size-ui-2xs)] font-black uppercase tracking-[0.16em] text-[var(--text-muted)]">
              <span>{t('accounts.openai_provider_current_name')}</span>
              <span className="break-all text-right text-[var(--text-primary)]">{draft.currentName}</span>
            </div>
            <div className="flex items-center justify-between gap-4 text-[length:var(--font-size-ui-2xs)] font-black uppercase tracking-[0.16em] text-[var(--text-muted)]">
              <span>{t('accounts.openai_provider_last_verified')}</span>
              <span className="break-all text-right text-[var(--text-primary)]">{formatLastVerifiedAt(verifyState.lastVerifiedAt)}</span>
            </div>
          </div>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-auto">
        <AccountDetailBody>
          {leadingSections}

          <AccountDetailModuleStack layout="cards" cardColumns={1}>
          <AccountDetailSection componentName="OpenAICompatibleEndpointSection" eyebrow="Endpoint" title={t('accounts.openai_provider_name')} meta={draft.currentName}>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="space-y-2">
                <div className="text-[length:var(--font-size-ui-xs)] font-black uppercase tracking-[0.2em] text-[var(--text-muted)]">
                  {t('accounts.ui_base_url')}
                </div>
                <input
                  value={draft.baseUrl}
                  onChange={(event) => onChange({ ...draft, baseUrl: event.target.value })}
                  className="input-swiss w-full"
                  placeholder={selectedPreset?.baseUrl || 'https://api.deepseek.com/v1'}
                />
              </label>

              <label className="space-y-2">
                <div className="text-[length:var(--font-size-ui-xs)] font-black uppercase tracking-[0.2em] text-[var(--text-muted)]">
                  {t('accounts.ui_api_key')}
                </div>
                <input
                  value={draft.apiKey}
                  onChange={(event) => onChange({ ...draft, apiKey: event.target.value })}
                  className="input-swiss w-full"
                  type="text"
                  placeholder={selectedPreset?.apiKeyPlaceholder || 'sk-...'}
                />
              </label>
            </div>
          </AccountDetailSection>

          <AccountProxyRouteSection
            proxyUrl={draft.proxyUrl}
            onProxyUrlChange={(nextProxyURL) => onChange({ ...draft, proxyUrl: nextProxyURL })}
            onValidityChange={setProxyRouteError}
          />

          <AccountDetailSection
            componentName="OpenAICompatibleHeadersSection"
            eyebrow="HTTP"
            title={t('accounts.openai_provider_headers')}
            actions={
              <button
                type="button"
                onClick={() => setHeadersExpanded((prev) => !prev)}
                className="btn-swiss !px-2 !py-1 !text-[length:var(--font-size-ui-2xs)]"
              >
                {draft.headersText || headersExpanded ? '−' : '+'}
              </button>
            }
          >
            {draft.headersText || headersExpanded ? (
              <>
                <textarea
                  value={draft.headersText}
                  onChange={(event) => onChange({ ...draft, headersText: event.target.value })}
                  className="input-swiss min-h-32 w-full resize-y font-mono !text-[length:var(--font-size-ui-md-compact)] leading-6"
                  placeholder={'Authorization: Bearer sk-...\nHTTP-Referer: https://example.com\nX-Title: GetTokens'}
                />
                <div className="text-[length:var(--font-size-ui-2xs)] font-black uppercase tracking-[0.14em] text-[var(--text-muted)]">
                  {t('accounts.openai_provider_headers_hint')}
                </div>
              </>
            ) : null}
          </AccountDetailSection>

          <AccountDetailSection
            componentName="OpenAICompatibleModelsSection"
            eyebrow="Model Catalog"
            title={t('accounts.openai_provider_models')}
            span="wide"
            actions={
              <>
                {remoteModelsState?.status === 'success' && remoteModelsState.models.length > 0 ? (
                  <button onClick={onApplyFetchedModels} className="btn-swiss !py-1.5 !text-[length:var(--font-size-ui-xs)]">
                    {t('accounts.openai_provider_models_apply_remote')}
                  </button>
                ) : null}
                <button
                  onClick={onFetchModels}
                  className="btn-swiss !py-1.5 !text-[length:var(--font-size-ui-xs)]"
                  disabled={remoteModelsState?.status === 'loading'}
                >
                  {remoteModelsState?.status === 'loading'
                    ? t('accounts.openai_provider_models_fetch_running')
                    : t('accounts.openai_provider_models_fetch')}
                </button>
              </>
            }
          >
              <div className="space-y-2 border border-[var(--border-color)] bg-[var(--bg-surface)] px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-[length:var(--font-size-ui-2xs)] font-black uppercase tracking-[0.22em] text-[var(--text-muted)]">
                    {t('accounts.openai_provider_models_source')}
                  </div>
                  <div className="text-[length:var(--font-size-ui-2xs)] font-black uppercase tracking-[0.16em] text-[var(--text-muted)]">
                    {modelSourceLabel}
                  </div>
                </div>
                <div className="text-[length:var(--font-size-ui-sm)] font-black uppercase tracking-tight text-[var(--text-primary)]">
                  {remoteModelsState?.message ||
                    (suggestedModelOptions.source === 'remote'
                      ? t('accounts.openai_provider_models_fetch_success')
                      : t('accounts.openai_provider_models_fetch_idle'))}
                </div>
              </div>

              <datalist id="openai-compatible-remote-models">
                {suggestedModels
                  .filter((item) => item.name.trim())
                  .map((item) => (
                    <option key={`${item.name}:${item.alias}`} value={item.name}>
                      {item.alias || item.name}
                    </option>
                  ))}
              </datalist>

              <div className="space-y-3">
                {draft.models.map((row, index) => (
                  <div
                    key={`model-${index}`}
                    className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]"
                  >
                    <input
                      value={row.name}
                      onChange={(event) => {
                        const nextModels = [...draft.models];
                        nextModels[index] = { ...nextModels[index], name: event.target.value };
                        onChange({ ...draft, models: nextModels });
                      }}
                      list="openai-compatible-remote-models"
                      className="input-swiss"
                      placeholder={suggestedModels[0]?.name || 'deepseek-chat'}
                    />
                    <input
                      value={row.alias}
                      onChange={(event) => {
                        const nextModels = [...draft.models];
                        nextModels[index] = { ...nextModels[index], alias: event.target.value };
                        onChange({ ...draft, models: nextModels });
                      }}
                      className="input-swiss"
                      placeholder="chat"
                    />
                    <button
                      onClick={() => {
                        const nextModels = draft.models.filter((_, itemIndex) => itemIndex !== index);
                        const nextVerifyModel = draft.verifyModel === row.name ? nextModels[0]?.name || '' : draft.verifyModel;
                        onChange({
                          ...draft,
                          models: nextModels.length > 0 ? nextModels : [{ name: '', alias: '' }],
                          verifyModel: nextVerifyModel,
                        });
                      }}
                      className="btn-swiss whitespace-nowrap !px-3 !py-1.5 !text-[length:var(--font-size-ui-xs)] !text-[var(--color-status-danger)] md:col-span-2 md:justify-self-start xl:col-span-1 xl:justify-self-end"
                      disabled={draft.models.length === 1}
                    >
                      {t('common.delete')}
                    </button>
                  </div>
                ))}
                <button
                  onClick={() => onChange({ ...draft, models: [...draft.models, { name: '', alias: '' }] })}
                  className="btn-swiss !py-1.5 !text-[length:var(--font-size-ui-xs)]"
                >
                  {t('accounts.openai_provider_add_model')}
                </button>
              </div>
            </AccountDetailSection>

          <AccountDetailSection componentName="OpenAICompatibleVerifySection" muted eyebrow="Connection" title={t('accounts.openai_provider_test_model')}>
            <div className="space-y-4">
              {suggestedModels.some((item) => item.name.trim()) ? (
                <div className="flex flex-wrap gap-2">
                  {suggestedModels
                    .filter((item) => item.name.trim())
                    .map((item) => {
                      const modelName = item.name.trim();
                      return (
                        <button
                          key={`${item.name}:${item.alias}`}
                          onClick={() => onChange({ ...draft, verifyModel: modelName })}
                          className={`border-2 px-2 py-1 text-[length:var(--font-size-ui-xs)] font-black uppercase tracking-[0.12em] transition-colors active:scale-95 ${
                            effectiveVerifyModel === modelName
                              ? 'border-[var(--text-primary)] bg-[var(--text-primary)] text-[var(--bg-main)]'
                              : 'border-[var(--border-color)] text-[var(--text-muted)] hover:border-[var(--text-primary)]'
                          }`}
                        >
                          {item.alias ? `${item.alias} / ${modelName}` : modelName}
                        </button>
                      );
                    })}
                </div>
              ) : null}
              <div className="flex items-end gap-3">
                <input
                  value={effectiveVerifyModel}
                  onChange={(event) => onChange({ ...draft, verifyModel: event.target.value })}
                  list="openai-compatible-remote-models"
                  className="input-swiss flex-1"
                  placeholder={selectedPreset?.models[0]?.name || 'deepseek-chat'}
                />
                <button
                  onClick={onVerify}
                  className="btn-swiss !py-2 !text-[length:var(--font-size-ui-xs)] whitespace-nowrap"
                  disabled={verifyState.status === 'loading'}
                >
                  {verifyState.status === 'loading'
                    ? t('accounts.openai_provider_test_running')
                    : t('accounts.openai_provider_test')}
                </button>
              </div>
              <div className="text-[length:var(--font-size-ui-2xs)] font-black uppercase tracking-[0.14em] text-[var(--text-muted)]">
                {t('accounts.openai_provider_test_model_hint')}
              </div>
            </div>
          </AccountDetailSection>

          {afterSections}
          </AccountDetailModuleStack>
        </AccountDetailBody>
      </div>

      {error ? (
        <AccountDetailNotice tone="danger" className="mx-6 mb-4 shrink-0">
          {error}
        </AccountDetailNotice>
      ) : null}

      <footer className="flex shrink-0 flex-col gap-3 border-t-2 border-[var(--border-color)] bg-[var(--bg-surface)] px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-[length:var(--font-size-ui-xs)] font-black uppercase tracking-[0.15em] text-[var(--text-muted)] sm:max-w-[70%]">
          {proxyRouteError || footerMessage || verifyState.message || t('accounts.openai_provider_test_idle')}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => void onSave()} className="btn-swiss bg-[var(--text-primary)] !text-[var(--bg-main)]" disabled={saving || Boolean(proxyRouteError)}>
            {saving ? t('common.loading') : t('common.save')}
          </button>
          <button onClick={onClose} className="btn-swiss">
            {t('common.cancel')}
          </button>
        </div>
      </footer>
    </>
  );
}
