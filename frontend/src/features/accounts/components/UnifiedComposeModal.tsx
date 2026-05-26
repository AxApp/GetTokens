import { useState } from 'react';
import SearchInput from '../../../components/ui/SearchInput';
import { getVendorPreset, getVendorPresets, type VendorPreset } from '../model/vendorPresets';
import { formatShortLabel } from '../model/vendorPresetHelpers';
import { resolveVendorDisplayName } from '../model/vendorIcons';
import {
  buildUnifiedComposeProviderAriaLabel,
  resolveUnifiedComposeFormatTitle,
  resolveUnifiedComposeModalCopy,
} from '../model/unifiedComposeCopy';
import type { ApiKeyFormState, ClickEventLike, TextInputEvent, Translator } from '../model/types';
import VendorLogoMark from './VendorLogoMark';

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
  const copy = resolveUnifiedComposeModalCopy(t);

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
        className="flex max-h-[90vh] w-full max-w-3xl flex-col border-2 border-[var(--border-color)] bg-[var(--bg-main)] shadow-hard shadow-[var(--shadow-color)]"
        onClick={(event: ClickEventLike) => event.stopPropagation()}
      >
        <header className="border-b-2 border-[var(--border-color)] px-6 py-4">
          <div className="text-[length:var(--font-size-ui-xs)] font-black uppercase tracking-[0.2em] text-[var(--text-muted)]">
            {copy.title}
          </div>
          <h3 className="mt-1 text-sm font-black uppercase italic tracking-tight text-[var(--text-primary)]">
            {showPresets ? copy.selectTitle : copy.configureTitle}
          </h3>
        </header>

        <div className="space-y-5 overflow-y-auto p-5">
          {showPresets ? (
            <div className="space-y-4">
              <SearchInput
                clearLabel={copy.searchClearLabel}
                value={presetSearch}
                onChange={setPresetSearch}
                placeholder={copy.searchPlaceholder}
                aria-label={copy.searchPlaceholder}
              />

              <div className="space-y-5">
                {Array.from(presetsByCategory.entries()).map(([category, items]) => (
                  <div key={category}>
                    <div className="text-[length:var(--font-size-ui-2xs)] font-black uppercase tracking-[0.2em] text-[var(--text-muted)] mb-2">
                      {copy.categoryLabels[category]}
                    </div>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                      {items.map((preset) => (
                        <button
                          key={preset.id}
                          onClick={() => handleSelectPreset(preset)}
                          title={preset.name}
                          aria-label={buildUnifiedComposeProviderAriaLabel(t, preset.name)}
                          className="group min-h-[5.35rem] border border-[var(--border-color)] bg-[var(--bg-surface)] px-2.5 py-2.5 text-left transition-[border-color,box-shadow,transform] hover:border-[var(--text-primary)] hover:shadow-[4px_4px_0_var(--shadow-color)] active:scale-[0.98]"
                        >
                          <div className="flex min-w-0 items-center gap-2">
                            <VendorLogoMark preset={preset} size="sm" />
                            <div className="min-w-0">
                              <div className="truncate text-[length:var(--font-size-ui-sm)] font-black uppercase tracking-[0.06em] text-[var(--text-primary)]">
                                {resolveVendorDisplayName(preset)}
                              </div>
                            </div>
                          </div>
                          <div className="mt-2 flex flex-wrap gap-1">
                            {preset.supportedFormats.map((fmt) => (
                              <span
                                key={fmt}
                                title={resolveUnifiedComposeFormatTitle(t, fmt)}
                                className="border border-[var(--border-color)] px-1.5 py-0.5 text-[length:var(--font-size-ui-3xs)] font-black uppercase tracking-[0.08em] text-[var(--text-muted)]"
                              >
                                {formatShortLabel(fmt)}
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
                  <div className="flex min-w-0 items-center gap-3">
                    <VendorLogoMark preset={selectedPreset} />
                    <div className="min-w-0">
                      <div className="truncate text-[length:var(--font-size-ui-lg)] font-black uppercase tracking-[0.04em] text-[var(--text-primary)]">
                        {resolveVendorDisplayName(selectedPreset)}
                      </div>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {selectedPreset.supportedFormats.map((fmt) => (
                          <span
                            key={fmt}
                            title={resolveUnifiedComposeFormatTitle(t, fmt)}
                            className="border border-[var(--border-color)] px-1.5 py-0.5 text-[length:var(--font-size-ui-3xs)] font-black uppercase tracking-[0.08em] text-[var(--text-muted)]"
                          >
                            {formatShortLabel(fmt)}
                          </span>
                        ))}
                      </div>
                    </div>
                    <button onClick={handleBackToPresets} className="btn-swiss !px-2 !py-1 !text-[length:var(--font-size-ui-2xs)]">
                      {copy.changeLabel}
                    </button>
                  </div>
                ) : null}
              </div>

              {selectedPreset && selectedPreset.supportedFormats.length > 0 ? (
                <div className="space-y-3">
                  <span className="text-[length:var(--font-size-ui-2xs)] font-black uppercase tracking-[0.2em] text-[var(--text-muted)]">
                    {copy.endpointsLabel}
                  </span>
                  {selectedPreset.supportedFormats.map((fmt) => {
                    const fmtBaseUrl = selectedPreset.formatBaseUrls?.[fmt] ?? selectedPreset.baseUrl;
                    return (
                      <div key={fmt} className="space-y-2">
                        <div className="flex items-center gap-2">
                          <span className="border border-[color:color-mix(in_srgb,var(--color-status-success)_40%,transparent)] bg-[color-mix(in_srgb,var(--color-status-success)_5%,transparent)] px-2 py-0.5 text-[length:var(--font-size-ui-xs)] font-black uppercase tracking-[0.12em] text-[var(--color-status-success)]">
                            {formatShortLabel(fmt)}
                          </span>
                          <span className="text-[length:var(--font-size-ui-3xs)] font-bold uppercase tracking-[0.1em] text-[var(--text-muted)]">
                            {copy.formatTargetLabels[fmt]}
                          </span>
                        </div>
                        <input
                          value={form.formatBaseUrls[fmt] ?? ''}
                          onChange={(e: TextInputEvent) => onFormatBaseUrlChange(fmt, e.target.value)}
                          className="input-swiss w-full font-mono !text-[length:var(--font-size-ui-xs)]"
                          placeholder={fmtBaseUrl}
                          aria-label={resolveUnifiedComposeFormatTitle(t, fmt)}
                        />
                      </div>
                    );
                  })}
                </div>
              ) : null}

              <label className="space-y-2">
                <span className="text-[length:var(--font-size-ui-xs)] font-black uppercase tracking-[0.18em] text-[var(--text-muted)]">
                  {copy.labelLabel}
                </span>
                <input
                  value={form.label}
                  onChange={(e: TextInputEvent) => onFormChange('label', e.target.value)}
                  className="input-swiss w-full"
                  placeholder={
                    selectedPreset
                      ? `${selectedPreset.name} ${copy.labelPlaceholderSuffix}`
                      : copy.labelPlaceholderDefault
                  }
                  aria-label={copy.labelLabel}
                />
              </label>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-2">
                  <span className="text-[length:var(--font-size-ui-xs)] font-black uppercase tracking-[0.18em] text-[var(--text-muted)]">
                    {copy.apiKeyLabel}
                  </span>
                  <input
                    value={form.apiKey}
                    onChange={(e: TextInputEvent) => onFormChange('apiKey', e.target.value)}
                    className="input-swiss w-full"
                    type="password"
                    placeholder={selectedPreset?.apiKeyPlaceholder ?? 'sk-...'}
                    aria-label={copy.apiKeyLabel}
                  />
                </label>
                <label className="space-y-2">
                  <span className="text-[length:var(--font-size-ui-xs)] font-black uppercase tracking-[0.18em] text-[var(--text-muted)]">
                    {copy.baseUrlPrimaryLabel}
                  </span>
                  <input
                    value={form.baseUrl}
                    onChange={(e: TextInputEvent) => onFormChange('baseUrl', e.target.value)}
                    className="input-swiss w-full"
                    placeholder={selectedPreset?.baseUrl ?? 'https://api.example.com/anthropic'}
                    aria-label={copy.baseUrlPrimaryLabel}
                  />
                </label>
              </div>

              <div className="border-2 border-[var(--border-color)] bg-[var(--bg-surface)]/30 px-4 py-4 space-y-3">
                <div className="text-[length:var(--font-size-ui-xs)] font-black uppercase tracking-[0.2em] text-[var(--text-muted)]">
                  {copy.advancedLabel}
                </div>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={form.quotaEnabled}
                    onChange={(e) => onFormChange('quotaEnabled', e.target.checked)}
                    aria-label={copy.quotaTrackingLabel}
                  />
                  <span className="text-[length:var(--font-size-ui-xs)] font-black uppercase tracking-[0.18em] text-[var(--text-muted)]">
                    {copy.quotaTrackingLabel}
                  </span>
                </label>
                <label className="space-y-2">
                  <span className="text-[length:var(--font-size-ui-xs)] font-black uppercase tracking-[0.18em] text-[var(--text-muted)]">
                    {copy.quotaCurlLabel}
                  </span>
                  <textarea
                    value={form.quotaCurl}
                    onChange={(e) => onFormChange('quotaCurl', e.target.value)}
                    className="input-swiss min-h-20 w-full resize-y font-mono !text-[length:var(--font-size-ui-xs)]"
                    placeholder={copy.quotaCurlPlaceholder}
                    aria-label={copy.quotaCurlLabel}
                  />
                </label>
              </div>

              {selectedPreset?.billingCurlTemplate ? (
                <div className="border-2 border-[var(--border-color)] bg-[var(--bg-surface)]/30 px-4 py-4 space-y-3">
                  <div className="text-[length:var(--font-size-ui-xs)] font-black uppercase tracking-[0.2em] text-[var(--text-muted)]">
                    {copy.billingLabel}
                  </div>
                  <label className="space-y-2">
                    <span className="text-[length:var(--font-size-ui-xs)] font-black uppercase tracking-[0.18em] text-[var(--text-muted)]">
                      {copy.billingCurlLabel}
                    </span>
                    <textarea
                      value={form.billingCurl}
                      onChange={(e) => onBillingCurlChange(e.target.value)}
                      className="input-swiss min-h-16 w-full resize-y font-mono !text-[length:var(--font-size-ui-xs)]"
                      placeholder={selectedPreset.billingCurlTemplate}
                      aria-label={copy.billingCurlLabel}
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
              {copy.submitLabel}
            </button>
          ) : (
            <button
              onClick={() => setShowPresets(false)}
              className="btn-swiss bg-[var(--text-primary)] !text-[var(--bg-main)]"
            >
              {copy.customEntryLabel}
            </button>
          )}
        </footer>
      </div>
    </div>
  );
}
