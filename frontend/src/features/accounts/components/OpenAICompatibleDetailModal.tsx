import type { Translator } from '../model/types';
import {
  resolveOpenAICompatibleProviderPreset,
  type OpenAICompatibleProviderDraft,
  type OpenAICompatibleModelRow,
  type ProviderVerifyState,
} from '../model/openAICompatible';

interface OpenAICompatibleDetailModalProps {
  t: Translator;
  draft: OpenAICompatibleProviderDraft;
  verifyState: ProviderVerifyState;
  error: string;
  saving: boolean;
  onClose: () => void;
  onChange: (next: OpenAICompatibleProviderDraft) => void;
  onSave: () => void;
  onVerify: () => void;
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
  error,
  saving,
  onClose,
  onChange,
  onSave,
  onVerify,
}: OpenAICompatibleDetailModalProps) {
  const selectedPreset = resolveOpenAICompatibleProviderPreset({
    name: draft.name,
    baseUrl: draft.baseUrl,
  });
  const suggestedModels: OpenAICompatibleModelRow[] = draft.models.some((item) => item.name.trim())
    ? draft.models
    : selectedPreset?.models || [];
  const effectiveVerifyModel = draft.verifyModel || suggestedModels[0]?.name || '';

  const messageTone =
    verifyState.status === 'success'
      ? 'text-green-600'
      : verifyState.status === 'error'
        ? 'text-red-500'
        : 'text-[var(--text-muted)]';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-6 backdrop-blur-sm" onClick={onClose}>
      <div
        className="flex w-full max-w-5xl flex-col border-2 border-[var(--border-color)] bg-[var(--bg-main)] shadow-hard shadow-[var(--shadow-color)]"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="border-b-2 border-[var(--border-color)] px-6 py-4">
          <div className="text-[9px] font-black uppercase tracking-[0.2em] text-[var(--text-muted)]">
            OPENAI-COMPATIBLE PROVIDER
          </div>
          <h3 className="mt-1 text-sm font-black uppercase italic tracking-tight text-[var(--text-primary)]">
            {draft.name || draft.currentName}
          </h3>
        </header>

        <div className="grid gap-0 overflow-auto xl:grid-cols-[1.1fr_0.9fr]">
          <section className="space-y-6 px-6 py-6 xl:border-r-2 xl:border-[var(--border-color)]">
            <div className="grid gap-5">
              <label className="space-y-2">
                <div className="text-[9px] font-black uppercase tracking-[0.2em] text-[var(--text-muted)]">
                  {t('accounts.openai_provider_name')}
                </div>
                <input
                  value={draft.name}
                  onChange={(event) => onChange({ ...draft, name: event.target.value })}
                  className="input-swiss w-full"
                  placeholder={selectedPreset?.id || 'deepseek'}
                />
              </label>

              <label className="space-y-2">
                <div className="text-[9px] font-black uppercase tracking-[0.2em] text-[var(--text-muted)]">
                  BASE URL
                </div>
                <input
                  value={draft.baseUrl}
                  onChange={(event) => onChange({ ...draft, baseUrl: event.target.value })}
                  className="input-swiss w-full"
                  placeholder={selectedPreset?.baseUrl || 'https://api.deepseek.com/v1'}
                />
              </label>

              <div className="space-y-3">
                <div className="text-[9px] font-black uppercase tracking-[0.2em] text-[var(--text-muted)]">
                  API KEYS
                </div>
                <div className="space-y-3">
                  {draft.apiKeys.map((apiKey, index) => (
                    <div key={`api-key-${index}`} className="flex items-center gap-3">
                      <input
                        value={apiKey}
                        onChange={(event) => {
                          const nextAPIKeys = [...draft.apiKeys];
                          nextAPIKeys[index] = event.target.value;
                          onChange({ ...draft, apiKey: nextAPIKeys[0] || '', apiKeys: nextAPIKeys });
                        }}
                        className="input-swiss flex-1"
                        type="password"
                        placeholder={selectedPreset?.apiKeyPlaceholder || 'sk-...'}
                      />
                      <button
                        onClick={() => {
                          const nextAPIKeys = draft.apiKeys.filter((_, itemIndex) => itemIndex !== index);
                          onChange({
                            ...draft,
                            apiKey: nextAPIKeys[0] || '',
                            apiKeys: nextAPIKeys.length > 0 ? nextAPIKeys : [''],
                          });
                        }}
                        className="btn-swiss !px-3 !py-1.5 !text-[9px] !text-red-500"
                        disabled={draft.apiKeys.length === 1}
                      >
                        {t('common.delete')}
                      </button>
                    </div>
                  ))}
                  <button
                    onClick={() => onChange({ ...draft, apiKeys: [...draft.apiKeys, ''] })}
                    className="btn-swiss !py-1.5 !text-[9px]"
                  >
                    {t('accounts.openai_provider_add_api_key')}
                  </button>
                </div>
              </div>

              <div className="space-y-3">
                <div className="text-[9px] font-black uppercase tracking-[0.2em] text-[var(--text-muted)]">
                  {t('accounts.openai_provider_headers')}
                </div>
                <div className="space-y-3">
                  {draft.headers.map((row, index) => (
                    <div key={`header-${index}`} className="grid gap-3 md:grid-cols-[1fr_1fr_auto]">
                      <input
                        value={row.key}
                        onChange={(event) => {
                          const nextHeaders = [...draft.headers];
                          nextHeaders[index] = { ...nextHeaders[index], key: event.target.value };
                          onChange({ ...draft, headers: nextHeaders });
                        }}
                        className="input-swiss"
                        placeholder="Authorization"
                      />
                      <input
                        value={row.value}
                        onChange={(event) => {
                          const nextHeaders = [...draft.headers];
                          nextHeaders[index] = { ...nextHeaders[index], value: event.target.value };
                          onChange({ ...draft, headers: nextHeaders });
                        }}
                        className="input-swiss"
                        placeholder="Bearer sk-..."
                      />
                      <button
                        onClick={() => {
                          const nextHeaders = draft.headers.filter((_, itemIndex) => itemIndex !== index);
                          onChange({ ...draft, headers: nextHeaders.length > 0 ? nextHeaders : [{ key: '', value: '' }] });
                        }}
                        className="btn-swiss !px-3 !py-1.5 !text-[9px] !text-red-500"
                        disabled={draft.headers.length === 1}
                      >
                        {t('common.delete')}
                      </button>
                    </div>
                  ))}
                  <button
                    onClick={() => onChange({ ...draft, headers: [...draft.headers, { key: '', value: '' }] })}
                    className="btn-swiss !py-1.5 !text-[9px]"
                  >
                    {t('accounts.openai_provider_add_header')}
                  </button>
                </div>
              </div>

              <div className="space-y-3">
                <div className="text-[9px] font-black uppercase tracking-[0.2em] text-[var(--text-muted)]">
                  {t('accounts.openai_provider_models')}
                </div>
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
                        className="input-swiss"
                        placeholder="deepseek-chat"
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
                          const nextVerifyModel =
                            draft.verifyModel === row.name ? nextModels[0]?.name || '' : draft.verifyModel;
                          onChange({
                            ...draft,
                            models: nextModels.length > 0 ? nextModels : [{ name: '', alias: '' }],
                            verifyModel: nextVerifyModel,
                          });
                        }}
                        className="btn-swiss !px-3 !py-1.5 !text-[9px] !text-red-500"
                        disabled={draft.models.length === 1}
                      >
                        {t('common.delete')}
                      </button>
                    </div>
                  ))}
                  <button
                    onClick={() => onChange({ ...draft, models: [...draft.models, { name: '', alias: '' }] })}
                    className="btn-swiss !py-1.5 !text-[9px]"
                  >
                    {t('accounts.openai_provider_add_model')}
                  </button>
                </div>
              </div>
            </div>
          </section>

          <section className="space-y-6 px-6 py-6">
            <div className="space-y-4">
              <div className="text-[9px] font-black uppercase tracking-[0.2em] text-[var(--text-muted)]">
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
                          className={`border-2 px-2 py-1 text-[9px] font-black uppercase tracking-[0.12em] transition-colors ${
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
                  className="input-swiss flex-1"
                  placeholder={selectedPreset?.models[0]?.name || 'deepseek-chat'}
                />
                <button
                  onClick={onVerify}
                  className="btn-swiss !py-2 !text-[9px] whitespace-nowrap"
                  disabled={verifyState.status === 'loading'}
                >
                  {verifyState.status === 'loading'
                    ? t('accounts.openai_provider_test_running')
                    : t('accounts.openai_provider_test')}
                </button>
              </div>
            </div>

            <div className="space-y-2 border border-[var(--border-color)] bg-[var(--bg-surface)] px-4 py-3">
              <div className="text-[8px] font-black uppercase tracking-[0.22em] text-[var(--text-muted)]">
                {t('accounts.openai_provider_test_summary')}
              </div>
              <div className={`text-[10px] font-black uppercase tracking-tight ${messageTone}`}>
                {verifyState.message || t('accounts.openai_provider_test_idle')}
              </div>
            </div>

            <div className="grid gap-4 border-t border-dashed border-[var(--border-color)] pt-6 md:grid-cols-2">
              <div className="space-y-1">
                <div className="text-[8px] font-black uppercase tracking-[0.18em] text-[var(--text-muted)]">
                  {t('accounts.openai_provider_current_name')}
                </div>
                <div className="break-all text-[10px] font-black uppercase text-[var(--text-primary)]">
                  {draft.currentName}
                </div>
              </div>
              <div className="space-y-1">
                <div className="text-[8px] font-black uppercase tracking-[0.18em] text-[var(--text-muted)]">
                  {t('accounts.openai_provider_last_verified')}
                </div>
                <div className="break-all text-[10px] font-black uppercase text-[var(--text-primary)]">
                  {formatLastVerifiedAt(verifyState.lastVerifiedAt)}
                </div>
              </div>
            </div>
          </section>
        </div>

        {error ? (
          <div className="mx-6 mb-6 border-2 border-red-500 bg-red-500/10 px-4 py-3 text-[10px] font-black uppercase tracking-wide text-red-500">
            {error}
          </div>
        ) : null}

        <footer className="flex items-center justify-between border-t-2 border-[var(--border-color)] bg-[var(--bg-surface)] px-6 py-4">
          <button onClick={onClose} className="btn-swiss">
            {t('common.cancel')}
          </button>
          <button onClick={onSave} className="btn-swiss bg-[var(--text-primary)] !text-[var(--bg-main)]" disabled={saving}>
            {saving ? t('common.loading') : t('common.save')}
          </button>
        </footer>
      </div>
    </div>
  );
}
