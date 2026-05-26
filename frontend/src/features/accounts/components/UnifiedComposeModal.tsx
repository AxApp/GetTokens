import { useState } from 'react';
import FormField, { TextInputField } from '../../../components/ui/FormField';
import SearchInput from '../../../components/ui/SearchInput';
import ToggleSwitch from '../../../components/ui/ToggleSwitch';
import { getVendorPreset, getVendorPresets, type VendorPreset } from '../model/vendorPresets';
import { formatShortLabel } from '../model/vendorPresetHelpers';
import { resolveVendorDisplayName } from '../model/vendorIcons';
import {
  buildUnifiedComposeProviderAriaLabel,
  resolveUnifiedComposeFormatTitle,
  resolveUnifiedComposeModalCopy,
} from '../model/unifiedComposeCopy';
import type { ApiKeyFormState, Translator } from '../model/types';
import AccountDetailModalFrame from './AccountDetailModalFrame';
import {
  AccountDetailBody,
  AccountDetailModuleStack,
  AccountDetailNotice,
  AccountDetailPill,
  AccountDetailSection,
} from './AccountDetailPrimitives';
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

type UnifiedComposeCopy = ReturnType<typeof resolveUnifiedComposeModalCopy>;

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
  const labelPlaceholder = selectedPreset
    ? `${selectedPreset.name} ${copy.labelPlaceholderSuffix}`
    : copy.labelPlaceholderDefault;

  return (
    <AccountDetailModalFrame
      onClose={onClose}
      header={
        <UnifiedComposeHeader
          copy={copy}
          selectedPreset={selectedPreset}
          showPresets={showPresets}
          onBackToPresets={handleBackToPresets}
        />
      }
      error={error ? (
        <AccountDetailNotice tone="danger" className="mx-6 mb-4 shrink-0">
          {error}
        </AccountDetailNotice>
      ) : undefined}
      footer={
        <UnifiedComposeFooter
          copy={copy}
          t={t}
          showPresets={showPresets}
          canSubmit={apiKeyFilled && baseUrlFilled}
          onClose={onClose}
          onCustomEntry={() => setShowPresets(false)}
          onSubmit={onSubmit}
        />
      }
    >
      <AccountDetailBody>
        {showPresets ? (
          <div className="space-y-4">
            <SearchInput
              clearLabel={copy.searchClearLabel}
              value={presetSearch}
              onChange={setPresetSearch}
              placeholder={copy.searchPlaceholder}
              aria-label={copy.searchPlaceholder}
            />

            <div className="space-y-4">
              {Array.from(presetsByCategory.entries()).map(([category, items]) => (
                <AccountDetailSection
                  key={category}
                  componentName="UnifiedComposeProviderCategorySection"
                  eyebrow={copy.providerEyebrow}
                  title={copy.categoryLabels[category]}
                  meta={`${items.length}`}
                  density="dense"
                >
                  <div className="grid grid-cols-3 gap-2">
                    {items.map((preset) => (
                      <button
                        key={preset.id}
                        onClick={() => handleSelectPreset(preset)}
                        title={preset.name}
                        aria-label={buildUnifiedComposeProviderAriaLabel(t, preset.name)}
                        className="group grid min-h-[7.25rem] grid-rows-[auto_1fr_auto] overflow-hidden border border-[var(--border-color)] bg-[var(--bg-surface)] px-3 py-3 text-left transition-[border-color,box-shadow,transform] hover:border-[var(--text-primary)] hover:shadow-[4px_4px_0_var(--shadow-color)] active:scale-[0.98]"
                      >
                        <div className="flex min-w-0 items-start justify-between gap-2">
                          <VendorLogoMark preset={preset} />
                          <span className="max-w-[6.75rem] truncate border border-dashed border-[var(--border-color)] px-1.5 py-0.5 text-[length:var(--font-size-ui-3xs)] font-black uppercase tracking-[0.12em] text-[var(--text-muted)]">
                            {copy.categoryLabels[preset.category]}
                          </span>
                        </div>
                        <div className="mt-3 flex min-w-0 items-end">
                          <div className="truncate text-[length:var(--font-size-ui-lg)] font-black tracking-normal text-[var(--text-primary)]">
                            {resolveVendorDisplayName(preset)}
                          </div>
                        </div>
                        <div className="mt-2 flex min-h-[1.25rem] flex-wrap content-end gap-1">
                          {preset.supportedFormats.map((fmt) => (
                            <AccountDetailPill
                              key={fmt}
                              className="!min-h-0 bg-[var(--bg-main)] !px-1.5 !py-0.5 !text-[length:var(--font-size-ui-3xs)] !tracking-[0.08em]"
                            >
                              {copy.formatTargetLabels[fmt]}
                            </AccountDetailPill>
                          ))}
                        </div>
                      </button>
                    ))}
                  </div>
                </AccountDetailSection>
              ))}
            </div>
          </div>
        ) : (
          <AccountDetailModuleStack layout="cards">
            {selectedPreset && selectedPreset.supportedFormats.length > 0 ? (
              <AccountDetailSection
                componentName="UnifiedComposeEndpointSection"
                eyebrow={copy.endpointEyebrow}
                title={copy.endpointsLabel}
                meta={selectedPreset.baseUrl}
                span="wide"
              >
                <div className="grid gap-3">
                  {selectedPreset.supportedFormats.map((fmt) => {
                    const fmtBaseUrl = selectedPreset.formatBaseUrls?.[fmt] ?? selectedPreset.baseUrl;
                    return (
                      <div
                        key={fmt}
                        className="grid min-w-0 gap-3 border-2 border-[var(--border-color)] bg-[var(--bg-surface)] p-3 xl:grid-cols-[10rem_minmax(0,1fr)] xl:items-end"
                      >
                        <div className="min-w-0 space-y-1">
                          <AccountDetailPill tone="success" className="!min-h-0 !py-0.5 !tracking-[0.12em]">
                            {formatShortLabel(fmt)}
                          </AccountDetailPill>
                          <div className="truncate text-[length:var(--font-size-ui-2xs)] font-black uppercase tracking-[0.14em] text-[var(--text-muted)]">
                            {copy.formatTargetLabels[fmt]}
                          </div>
                        </div>
                        <TextInputField
                          title={resolveUnifiedComposeFormatTitle(t, fmt)}
                          value={form.formatBaseUrls[fmt] ?? ''}
                          onChange={(event) => onFormatBaseUrlChange(fmt, event.target.value)}
                          className="font-mono !text-[length:var(--font-size-ui-xs)]"
                          fieldClassName="min-w-0"
                          placeholder={fmtBaseUrl}
                          aria-label={resolveUnifiedComposeFormatTitle(t, fmt)}
                        />
                      </div>
                    );
                  })}
                </div>
              </AccountDetailSection>
            ) : null}

            <AccountDetailSection
              componentName="UnifiedComposeCredentialsSection"
              eyebrow={copy.credentialEyebrow}
              title={copy.credentialsLabel}
              span="wide"
            >
              <TextInputField
                title={copy.labelLabel}
                value={form.label}
                onChange={(event) => onFormChange('label', event.target.value)}
                placeholder={labelPlaceholder}
                aria-label={copy.labelLabel}
              />

              <div className="grid gap-4 xl:grid-cols-2">
                <TextInputField
                  title={copy.apiKeyLabel}
                  value={form.apiKey}
                  onChange={(event) => onFormChange('apiKey', event.target.value)}
                  type="password"
                  placeholder={selectedPreset?.apiKeyPlaceholder ?? 'sk-...'}
                  aria-label={copy.apiKeyLabel}
                />
                <TextInputField
                  title={copy.baseUrlPrimaryLabel}
                  value={form.baseUrl}
                  onChange={(event) => onFormChange('baseUrl', event.target.value)}
                  placeholder={selectedPreset?.baseUrl ?? 'https://api.example.com/anthropic'}
                  aria-label={copy.baseUrlPrimaryLabel}
                />
              </div>
            </AccountDetailSection>

            <AccountDetailSection
              componentName="UnifiedComposeAdvancedSection"
              eyebrow={copy.automationEyebrow}
              title={copy.advancedLabel}
              muted
            >
              <div className="flex min-w-0 items-center justify-between gap-4 border-2 border-[var(--border-color)] bg-[var(--bg-main)] px-3 py-2">
                <span className="min-w-0 text-[length:var(--font-size-ui-xs)] font-black uppercase tracking-[0.16em] text-[var(--text-primary)]">
                  {copy.quotaTrackingLabel}
                </span>
                <ToggleSwitch
                  label={copy.quotaTrackingLabel}
                  checked={form.quotaEnabled}
                  onChange={(checked) => onFormChange('quotaEnabled', checked)}
                />
              </div>
              <FormField title={copy.quotaCurlLabel}>
                <textarea
                  value={form.quotaCurl}
                  onChange={(event) => onFormChange('quotaCurl', event.target.value)}
                  className="input-swiss min-h-28 w-full resize-y font-mono !text-[length:var(--font-size-ui-xs)]"
                  placeholder={copy.quotaCurlPlaceholder}
                  aria-label={copy.quotaCurlLabel}
                />
              </FormField>
            </AccountDetailSection>

            {selectedPreset?.billingCurlTemplate ? (
              <AccountDetailSection
                componentName="UnifiedComposeBillingSection"
                eyebrow={copy.billingEyebrow}
                title={copy.billingLabel}
                muted
              >
                <FormField title={copy.billingCurlLabel}>
                  <textarea
                    value={form.billingCurl}
                    onChange={(event) => onBillingCurlChange(event.target.value)}
                    className="input-swiss min-h-28 w-full resize-y font-mono !text-[length:var(--font-size-ui-xs)]"
                    placeholder={selectedPreset.billingCurlTemplate}
                    aria-label={copy.billingCurlLabel}
                  />
                </FormField>
              </AccountDetailSection>
            ) : null}
          </AccountDetailModuleStack>
        )}
      </AccountDetailBody>
    </AccountDetailModalFrame>
  );
}

function UnifiedComposeHeader({
  copy,
  selectedPreset,
  showPresets,
  onBackToPresets,
}: {
  copy: UnifiedComposeCopy;
  selectedPreset?: VendorPreset;
  showPresets: boolean;
  onBackToPresets: () => void;
}) {
  const primaryTitle = selectedPreset && !showPresets
    ? resolveVendorDisplayName(selectedPreset)
    : showPresets
      ? copy.selectTitle
      : copy.configureTitle;

  return (
    <div className="space-y-3">
      <div className="text-[length:var(--font-size-ui-xs)] font-black uppercase tracking-[0.2em] text-[var(--text-muted)]">
        {copy.title}
      </div>
      <div className="flex min-w-0 items-start justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          {selectedPreset && !showPresets ? <VendorLogoMark preset={selectedPreset} /> : null}
          <div className="min-w-0">
            <h3 className="truncate text-[length:var(--font-size-ui-xl)] font-black uppercase italic tracking-tight text-[var(--text-primary)]">
              {primaryTitle}
            </h3>
            {!showPresets ? (
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                {selectedPreset ? (
                  <>
                    <AccountDetailPill className="!min-h-0 !py-0.5 !tracking-[0.12em]">
                      {copy.configureTitle}
                    </AccountDetailPill>
                    <AccountDetailPill className="!min-h-0 !py-0.5 !tracking-[0.12em]">
                      {copy.categoryLabels[selectedPreset.category]}
                    </AccountDetailPill>
                    {selectedPreset.supportedFormats.map((fmt) => (
                      <AccountDetailPill key={fmt} className="!min-h-0 !py-0.5 !tracking-[0.12em]">
                        {formatShortLabel(fmt)}
                      </AccountDetailPill>
                    ))}
                  </>
                ) : (
                  <AccountDetailPill className="!min-h-0 !py-0.5 !tracking-[0.12em]">
                    {copy.customEntryLabel}
                  </AccountDetailPill>
                )}
              </div>
            ) : null}
          </div>
        </div>
        {selectedPreset && !showPresets ? (
          <button type="button" onClick={onBackToPresets} className="btn-swiss shrink-0 !px-3 !py-2 !text-[length:var(--font-size-ui-xs)]">
            {copy.changeLabel}
          </button>
        ) : null}
      </div>
      {selectedPreset && !showPresets ? (
        <div className="truncate font-mono text-[length:var(--font-size-ui-xs)] text-[var(--text-muted)]">
          {selectedPreset.baseUrl}
        </div>
      ) : null}
    </div>
  );
}

function UnifiedComposeFooter({
  copy,
  t,
  showPresets,
  canSubmit,
  onClose,
  onCustomEntry,
  onSubmit,
}: {
  copy: UnifiedComposeCopy;
  t: Translator;
  showPresets: boolean;
  canSubmit: boolean;
  onClose: () => void;
  onCustomEntry: () => void;
  onSubmit: () => void;
}) {
  return (
    <>
      <button type="button" onClick={onClose} className="btn-swiss">
        {t('common.cancel')}
      </button>
      {showPresets ? (
        <button
          type="button"
          onClick={onCustomEntry}
          className="btn-swiss bg-[var(--text-primary)] !text-[var(--bg-main)]"
        >
          {copy.customEntryLabel}
        </button>
      ) : (
        <button
          type="button"
          onClick={onSubmit}
          disabled={!canSubmit}
          className="btn-swiss bg-[var(--text-primary)] !text-[var(--bg-main)] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {copy.submitLabel}
        </button>
      )}
    </>
  );
}
