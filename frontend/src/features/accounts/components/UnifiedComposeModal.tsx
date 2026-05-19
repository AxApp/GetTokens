import { useState } from 'react';
import { getVendorPreset, getVendorPresets, type VendorPreset } from '../model/vendorPresets';
import { formatLabel } from '../model/vendorPresetHelpers';
import type { ApiKeyFormState, ClickEventLike, TextInputEvent, Translator } from '../model/types';

const CATEGORY_LABELS: Record<VendorPreset['category'], string> = {
  official: 'Official',
  cn_official: 'Chinese Vendors',
  aggregator: 'Aggregators',
  third_party: 'Partners',
  cloud_provider: 'Cloud',
};

const CATEGORY_ORDER: VendorPreset['category'][] = [
  'official',
  'cn_official',
  'aggregator',
  'third_party',
  'cloud_provider',
];

export interface UnifiedComposeFormState extends ApiKeyFormState {
  formatBaseUrls: Partial<Record<string, string>>;
  billingCurl: string;
  billingEnabled: boolean;
}

interface UnifiedComposeModalProps {
  t: Translator;
  form: UnifiedComposeFormState;
  error: string;
  onClose: () => void;
  onFormChange: (field: keyof ApiKeyFormState, value: string | boolean) => void;
  onFormatBaseUrlChange: (format: string, value: string) => void;
  onBillingCurlChange: (value: string) => void;
  onPresetApply: (preset: VendorPreset) => void;
  onSubmit: () => void;
  initialShowPresets?: boolean;
  initialSelectedPresetID?: string;
  initialPresetSearch?: string;
}

export default function UnifiedComposeModal({
  t,
  form,
  error,
  onClose,
  onFormChange,
  onFormatBaseUrlChange,
  onBillingCurlChange,
  onPresetApply,
  onSubmit,
  initialShowPresets = true,
  initialSelectedPresetID = '',
  initialPresetSearch = '',
}: UnifiedComposeModalProps) {
  const presets = getVendorPresets();
  const [presetSearch, setPresetSearch] = useState(initialPresetSearch);
  const [showPresets, setShowPresets] = useState(initialShowPresets);
  const [selectedPresetID, setSelectedPresetID] = useState(initialSelectedPresetID);

  const selectedPreset = selectedPresetID ? getVendorPreset(selectedPresetID) : undefined;

  const filteredPresets = presetSearch.trim()
    ? presets.filter(
        (p) =>
          p.name.toLowerCase().includes(presetSearch.toLowerCase()) ||
          p.id.toLowerCase().includes(presetSearch.toLowerCase()),
      )
    : presets;

  const presetsByCategory = new Map<VendorPreset['category'], VendorPreset[]>();
  for (const cat of CATEGORY_ORDER) {
    const items = filteredPresets.filter((p) => p.category === cat);
    if (items.length > 0) presetsByCategory.set(cat, items);
  }

  function handleSelectPreset(preset: VendorPreset) {
    setSelectedPresetID(preset.id);
    onPresetApply(preset);
    setShowPresets(false);
  }

  function handleBackToPresets() {
    setShowPresets(true);
    setSelectedPresetID('');
  }

  const apiKeyFilled = form.apiKey.trim().length > 0;
  const baseUrlFilled = form.baseUrl.trim().length > 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--overlay-scrim-80)] p-6 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="flex w-full max-w-2xl flex-col border-2 border-[var(--border-color)] bg-[var(--bg-main)] shadow-hard shadow-[var(--shadow-color)] max-h-[90vh]"
        onClick={(event: ClickEventLike) => event.stopPropagation()}
      >
        <header className="border-b-2 border-[var(--border-color)] px-6 py-4">
          <div className="text-[length:var(--font-size-ui-xs)] font-black uppercase tracking-[0.2em] text-[var(--text-muted)]">
            ADD ACCOUNT
          </div>
          <h3 className="mt-1 text-sm font-black uppercase italic tracking-tight text-[var(--text-primary)]">
            {showPresets ? 'Select Provider' : 'Configure Account'}
          </h3>
        </header>

        <div className="overflow-y-auto p-6 space-y-6">
          {showPresets ? (
            <div className="space-y-4">
              <input
                value={presetSearch}
                onChange={(e: TextInputEvent) => setPresetSearch(e.target.value)}
                className="input-swiss w-full"
                placeholder="Search providers..."
              />

              <div className="space-y-6">
                {Array.from(presetsByCategory.entries()).map(([category, items]) => (
                  <div key={category}>
                    <div className="text-[length:var(--font-size-ui-2xs)] font-black uppercase tracking-[0.2em] text-[var(--text-muted)] mb-2">
                      {CATEGORY_LABELS[category]}
                    </div>
                    <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
                      {items.map((preset) => (
                        <button
                          key={preset.id}
                          onClick={() => handleSelectPreset(preset)}
                          className="border border-[var(--border-color)] bg-[var(--bg-surface)] px-3 py-3 text-left transition-[border-color,box-shadow] hover:border-[var(--text-primary)] hover:shadow-[4px_4px_0_var(--shadow-color)]"
                        >
                          <div className="text-[length:var(--font-size-ui-xs)] font-black uppercase tracking-[0.12em] text-[var(--text-primary)]">
                            {preset.name}
                          </div>
                          <div className="mt-1 flex flex-wrap gap-1">
                            {preset.supportedFormats.map((fmt) => (
                              <span
                                key={fmt}
                                className="border border-[var(--border-color)] px-1 text-[length:var(--font-size-ui-3xs)] font-black uppercase tracking-[0.1em] text-[var(--text-muted)]"
                              >
                                {formatLabel(fmt)}
                              </span>
                            ))}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="grid gap-5">
              <div className="flex items-center justify-between gap-3">
                {selectedPreset ? (
                  <div className="flex items-center gap-3">
                    <span className="border border-[var(--border-color)] bg-[var(--bg-surface)] px-3 py-2 text-[length:var(--font-size-ui-sm)] font-black uppercase tracking-[0.12em] text-[var(--text-primary)]">
                      {selectedPreset.name}
                    </span>
                    <button onClick={handleBackToPresets} className="btn-swiss !px-2 !py-1 !text-[length:var(--font-size-ui-2xs)]">
                      Change
                    </button>
                  </div>
                ) : null}
              </div>

              {selectedPreset && selectedPreset.supportedFormats.length > 0 ? (
                <div className="space-y-3">
                  <span className="text-[length:var(--font-size-ui-2xs)] font-black uppercase tracking-[0.2em] text-[var(--text-muted)]">
                    Endpoints — one for each format
                  </span>
                  {selectedPreset.supportedFormats.map((fmt, i) => {
                    const fmtBaseUrl = selectedPreset.formatBaseUrls?.[fmt] ?? selectedPreset.baseUrl;
                    return (
                      <div key={fmt} className="space-y-2">
                        <div className="flex items-center gap-2">
                          <span className="border border-[color:color-mix(in_srgb,var(--color-status-success)_40%,transparent)] bg-[color-mix(in_srgb,var(--color-status-success)_5%,transparent)] px-2 py-0.5 text-[length:var(--font-size-ui-xs)] font-black uppercase tracking-[0.12em] text-[var(--color-status-success)]">
                            {formatLabel(fmt)}
                          </span>
                          <span className="text-[length:var(--font-size-ui-3xs)] font-bold uppercase tracking-[0.1em] text-[var(--text-muted)]">
                            {fmt === 'anthropic' ? 'Claude Code' : fmt === 'openai_chat' ? 'Codex / OpenAI' : fmt === 'openai_responses' ? 'OpenAI Responses' : 'Gemini CLI'}
                          </span>
                        </div>
                        <input
                          value={form.formatBaseUrls[fmt] ?? ''}
                          onChange={(e: TextInputEvent) => onFormatBaseUrlChange(fmt, e.target.value)}
                          className="input-swiss w-full font-mono !text-[length:var(--font-size-ui-xs)]"
                          placeholder={fmtBaseUrl}
                        />
                      </div>
                    );
                  })}
                  <p className="text-[length:var(--font-size-ui-2xs)] font-bold uppercase tracking-[0.16em] text-[var(--text-muted)]">
                    {selectedPreset.supportedFormats.includes('anthropic') && selectedPreset.supportedFormats.includes('openai_chat')
                      ? '双端点原生支持，中继按格式自动路由，零转换开销。'
                      : '厂商端点原生支持，中继直接透传。'}
                  </p>
                </div>
              ) : null}

              <label className="space-y-2">
                <span className="text-[length:var(--font-size-ui-xs)] font-black uppercase tracking-[0.18em] text-[var(--text-muted)]">
                  Label
                </span>
                <input
                  value={form.label}
                  onChange={(e: TextInputEvent) => onFormChange('label', e.target.value)}
                  className="input-swiss w-full"
                  placeholder={selectedPreset ? `${selectedPreset.name} Account` : 'e.g. DeepSeek Proxy'}
                />
              </label>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-2">
                  <span className="text-[length:var(--font-size-ui-xs)] font-black uppercase tracking-[0.18em] text-[var(--text-muted)]">
                    API Key
                  </span>
                  <input
                    value={form.apiKey}
                    onChange={(e: TextInputEvent) => onFormChange('apiKey', e.target.value)}
                    className="input-swiss w-full"
                    type="password"
                    placeholder={selectedPreset?.apiKeyPlaceholder ?? 'sk-...'}
                  />
                </label>
                <label className="space-y-2">
                  <span className="text-[length:var(--font-size-ui-xs)] font-black uppercase tracking-[0.18em] text-[var(--text-muted)]">
                    Base URL (primary)
                  </span>
                  <input
                    value={form.baseUrl}
                    onChange={(e: TextInputEvent) => onFormChange('baseUrl', e.target.value)}
                    className="input-swiss w-full"
                    placeholder={selectedPreset?.baseUrl ?? 'https://api.example.com/anthropic'}
                  />
                </label>
              </div>

              <div className="border-2 border-[var(--border-color)] bg-[var(--bg-surface)]/30 px-4 py-4 space-y-3">
                <div className="text-[length:var(--font-size-ui-xs)] font-black uppercase tracking-[0.2em] text-[var(--text-muted)]">
                  Advanced
                </div>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={form.quotaEnabled}
                    onChange={(e) => onFormChange('quotaEnabled', e.target.checked)}
                  />
                  <span className="text-[length:var(--font-size-ui-xs)] font-black uppercase tracking-[0.18em] text-[var(--text-muted)]">
                    Quota Tracking
                  </span>
                </label>
                <label className="space-y-2">
                  <span className="text-[length:var(--font-size-ui-xs)] font-black uppercase tracking-[0.18em] text-[var(--text-muted)]">
                    Quota cURL
                  </span>
                  <textarea
                    value={form.quotaCurl}
                    onChange={(e) => onFormChange('quotaCurl', e.target.value)}
                    className="input-swiss min-h-20 w-full resize-y font-mono !text-[length:var(--font-size-ui-xs)]"
                    placeholder='curl -sS "https://api.example.com/usage" -H "Authorization: Bearer {{apiKey}}"'
                  />
                </label>
              </div>

              {selectedPreset?.billingCurlTemplate ? (
                <div className="border-2 border-[var(--border-color)] bg-[var(--bg-surface)]/30 px-4 py-4 space-y-3">
                  <div className="text-[length:var(--font-size-ui-xs)] font-black uppercase tracking-[0.2em] text-[var(--text-muted)]">
                    Billing
                  </div>
                  <label className="space-y-2">
                    <span className="text-[length:var(--font-size-ui-xs)] font-black uppercase tracking-[0.18em] text-[var(--text-muted)]">
                      Balance cURL
                    </span>
                    <textarea
                      value={form.billingCurl}
                      onChange={(e) => onBillingCurlChange(e.target.value)}
                      className="input-swiss min-h-16 w-full resize-y font-mono !text-[length:var(--font-size-ui-xs)]"
                      placeholder={selectedPreset.billingCurlTemplate}
                    />
                  </label>
                </div>
              ) : null}
            </div>
          )}

          {error ? (
            <div className="border-2 border-[var(--color-status-danger)] bg-[color-mix(in_srgb,var(--color-status-danger)_10%,transparent)] px-4 py-3 text-[length:var(--font-size-ui-sm)] font-black uppercase tracking-wide text-[var(--color-status-danger)]">
              {error}
            </div>
          ) : null}
        </div>

        <footer className="flex items-center justify-between border-t-2 border-[var(--border-color)] bg-[var(--bg-surface)] px-6 py-4">
          <button onClick={onClose} className="btn-swiss">
            {t('common.cancel')}
          </button>
          {!showPresets ? (
            <button
              onClick={onSubmit}
              disabled={!apiKeyFilled || !baseUrlFilled}
              className="btn-swiss bg-[var(--text-primary)] !text-[var(--bg-main)]"
            >
              Add Account
            </button>
          ) : (
            <button
              onClick={() => setShowPresets(false)}
              className="btn-swiss bg-[var(--text-primary)] !text-[var(--bg-main)]"
            >
              Custom Entry
            </button>
          )}
        </footer>
      </div>
    </div>
  );
}
