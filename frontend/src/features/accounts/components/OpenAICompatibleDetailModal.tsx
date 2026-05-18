import { useState } from 'react';
import type { Translator } from '../model/types';
import {
  resolveProviderDetailModelOptions,
  resolveOpenAICompatibleProviderPreset,
  type OpenAICompatibleProviderDraft,
  type OpenAICompatibleModelRow,
  type ProviderRemoteModelsState,
  type ProviderVerifyState,
} from '../model/openAICompatible';
import type { RateLimitState, RateLimitStrategyMeta } from '../model/rateLimit';
import AccountDetailModalFrame from './AccountDetailModalFrame';
import AccountProxyRouteSection from './AccountProxyRouteSection';
import RateLimitRulesSection from './RateLimitRulesSection';

interface OpenAICompatibleDetailModalProps {
  t: Translator;
  draft: OpenAICompatibleProviderDraft;
  verifyState: ProviderVerifyState;
  remoteModelsState?: ProviderRemoteModelsState;
  rateLimitStatus?: RateLimitState;
  rateLimitStrategies?: RateLimitStrategyMeta[];
  error: string;
  saving: boolean;
  onClose: () => void;
  onChange: (next: OpenAICompatibleProviderDraft) => void;
  onSave: () => void;
  onVerify: () => void;
  onFetchModels: () => void;
  onApplyFetchedModels: () => void;
  onRateLimitRulesChanged: () => void;
}

function formatLastVerifiedAt(timestamp: number | null) {
  if (!timestamp) {
    return '—';
  }
  return new Date(timestamp).toLocaleString();
}

export default function OpenAICompatibleDetailModal({
  t,
  draft,
  verifyState,
  remoteModelsState,
  rateLimitStatus,
  rateLimitStrategies,
  error,
  saving,
  onClose,
  onChange,
  onSave,
  onVerify,
  onFetchModels,
  onApplyFetchedModels,
  onRateLimitRulesChanged,
}: OpenAICompatibleDetailModalProps) {
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
  const rateLimitAccountName = draft.currentName || draft.name;
  const rateLimitAccountKey = `openai-compatible:${rateLimitAccountName}`;
  const rateLimitMatchKey = rateLimitStatus?.matchKey || `provider:${rateLimitAccountName.trim().toLowerCase()}`;
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
      ? 'text-green-600'
      : verifyState.status === 'error'
        ? 'text-red-500'
        : 'text-[var(--text-muted)]';

  return (
    <AccountDetailModalFrame onClose={onClose}>
        <header className="shrink-0 border-b-2 border-[var(--border-color)] px-6 py-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0 flex-1 space-y-2">
              <div className="text-[0.5625rem] font-black uppercase tracking-[0.2em] text-[var(--text-muted)]">
                {t('accounts.ui_openai_account_badge')}
              </div>
              <div className="space-y-3">
                <h3 className="text-[0.75rem] font-black uppercase italic tracking-[0.08em] text-[var(--text-primary)]">
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
                <div className="text-[0.5rem] font-black uppercase tracking-[0.22em] text-[var(--text-muted)]">
                  {t('accounts.openai_provider_test_summary')}
                </div>
                <div className="text-[0.5rem] font-black uppercase tracking-[0.16em] text-[var(--text-muted)]">
                  {verifyState.model || '—'}
                </div>
              </div>
              <div className={`text-[0.625rem] font-black uppercase tracking-tight ${messageTone}`}>
                {verifyState.message || t('accounts.openai_provider_test_idle')}
              </div>
              <div className="flex items-center justify-between gap-4 text-[0.5rem] font-black uppercase tracking-[0.16em] text-[var(--text-muted)]">
                <span>{t('accounts.openai_provider_current_name')}</span>
                <span className="break-all text-right text-[var(--text-primary)]">{draft.currentName}</span>
              </div>
              <div className="flex items-center justify-between gap-4 text-[0.5rem] font-black uppercase tracking-[0.16em] text-[var(--text-muted)]">
                <span>{t('accounts.openai_provider_last_verified')}</span>
                <span className="break-all text-right text-[var(--text-primary)]">{formatLastVerifiedAt(verifyState.lastVerifiedAt)}</span>
              </div>
            </div>
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-auto">
            <section className="min-h-0 px-6 py-6">
            <div className="space-y-6">
              <label className="space-y-2">
                <div className="text-[0.5625rem] font-black uppercase tracking-[0.2em] text-[var(--text-muted)]">
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
                <div className="text-[0.5625rem] font-black uppercase tracking-[0.2em] text-[var(--text-muted)]">
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

              <AccountProxyRouteSection
                proxyUrl={draft.proxyUrl}
                onProxyUrlChange={(nextProxyURL) => onChange({ ...draft, proxyUrl: nextProxyURL })}
                onValidityChange={setProxyRouteError}
              />

              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => setHeadersExpanded((prev) => !prev)}
                  className="flex w-full items-center gap-2 text-[0.5625rem] font-black uppercase tracking-[0.2em] text-[var(--text-muted)] transition-colors hover:text-[var(--text-primary)]"
                >
                  <span className="inline-grid h-3.5 w-3.5 place-items-center border border-[var(--border-color)] text-[0.5rem] leading-none">
                    {draft.headersText || headersExpanded ? '−' : '+'}
                  </span>
                  {t('accounts.openai_provider_headers')}
                </button>
                {(draft.headersText || headersExpanded) ? (
                  <>
                    <textarea
                      value={draft.headersText}
                      onChange={(event) => onChange({ ...draft, headersText: event.target.value })}
                      className="input-swiss min-h-32 w-full resize-y font-mono !text-[0.6875rem] leading-6"
                      placeholder={'Authorization: Bearer sk-...\nHTTP-Referer: https://example.com\nX-Title: GetTokens'}
                    />
                    <div className="text-[0.5rem] font-black uppercase tracking-[0.14em] text-[var(--text-muted)]">
                      {t('accounts.openai_provider_headers_hint')}
                    </div>
                  </>
                ) : null}
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-[0.5625rem] font-black uppercase tracking-[0.2em] text-[var(--text-muted)]">
                    {t('accounts.openai_provider_models')}
                  </div>
                  <div className="flex items-center gap-2">
                    {remoteModelsState?.status === 'success' && remoteModelsState.models.length > 0 ? (
                      <button onClick={onApplyFetchedModels} className="btn-swiss !py-1.5 !text-[0.5625rem]">
                        {t('accounts.openai_provider_models_apply_remote')}
                      </button>
                    ) : null}
                    <button
                      onClick={onFetchModels}
                      className="btn-swiss !py-1.5 !text-[0.5625rem]"
                      disabled={remoteModelsState?.status === 'loading'}
                    >
                      {remoteModelsState?.status === 'loading'
                        ? t('accounts.openai_provider_models_fetch_running')
                        : t('accounts.openai_provider_models_fetch')}
                    </button>
                  </div>
                </div>
                <div className="space-y-2 border border-[var(--border-color)] bg-[var(--bg-surface)] px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-[0.5rem] font-black uppercase tracking-[0.22em] text-[var(--text-muted)]">
                      {t('accounts.openai_provider_models_source')}
                    </div>
                    <div className="text-[0.5rem] font-black uppercase tracking-[0.16em] text-[var(--text-muted)]">
                      {modelSourceLabel}
                    </div>
                  </div>
                  <div className="text-[0.625rem] font-black uppercase tracking-tight text-[var(--text-primary)]">
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
                    <div key={`model-${index}`} className="grid gap-3 md:grid-cols-[1fr_1fr_auto]">
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
                        className="btn-swiss !px-3 !py-1.5 !text-[0.5625rem] !text-red-500"
                        disabled={draft.models.length === 1}
                      >
                        {t('common.delete')}
                      </button>
                    </div>
                  ))}
                  <button
                    onClick={() => onChange({ ...draft, models: [...draft.models, { name: '', alias: '' }] })}
                    className="btn-swiss !py-1.5 !text-[0.5625rem]"
                  >
                    {t('accounts.openai_provider_add_model')}
                  </button>
                </div>
              </div>
            </div>
          </section>

          <section className="min-h-0 space-y-6 border-t-2 border-[var(--border-color)] bg-[var(--bg-surface)]/30 px-6 py-6">
            <div className="space-y-4">
              <div className="text-[0.5625rem] font-black uppercase tracking-[0.2em] text-[var(--text-muted)]">
                {t('accounts.openai_provider_test_model')}
              </div>
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
                          className={`border-2 px-2 py-1 text-[0.5625rem] font-black uppercase tracking-[0.12em] transition-colors ${
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
                  className="btn-swiss !py-2 !text-[0.5625rem] whitespace-nowrap"
                  disabled={verifyState.status === 'loading'}
                >
                  {verifyState.status === 'loading'
                    ? t('accounts.openai_provider_test_running')
                    : t('accounts.openai_provider_test')}
                </button>
              </div>
              <div className="text-[0.5rem] font-black uppercase tracking-[0.14em] text-[var(--text-muted)]">
                {t('accounts.openai_provider_test_model_hint')}
              </div>
            </div>
          </section>
          <RateLimitRulesSection
            accountKey={rateLimitAccountKey}
            matchKey={rateLimitMatchKey}
            rateLimitStatus={rateLimitStatus}
            rateLimitStrategies={rateLimitStrategies}
            onRateLimitRulesChanged={onRateLimitRulesChanged}
            t={t}
          />
        </div>

        {error ? (
          <div className="mx-6 mb-4 shrink-0 border-2 border-red-500 bg-red-500/10 px-4 py-3 text-[0.625rem] font-black uppercase tracking-wide text-red-500">
            {error}
          </div>
        ) : null}

        <footer className="flex shrink-0 flex-col gap-3 border-t-2 border-[var(--border-color)] bg-[var(--bg-surface)] px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-[0.5625rem] font-black uppercase tracking-[0.15em] text-[var(--text-muted)] sm:max-w-[70%]">
            {proxyRouteError || verifyState.message || t('accounts.openai_provider_test_idle')}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={onSave} className="btn-swiss bg-[var(--text-primary)] !text-[var(--bg-main)]" disabled={saving || Boolean(proxyRouteError)}>
              {saving ? t('common.loading') : t('common.save')}
            </button>
            <button onClick={onClose} className="btn-swiss">
              {t('common.cancel')}
            </button>
          </div>
        </footer>
    </AccountDetailModalFrame>
  );
}
