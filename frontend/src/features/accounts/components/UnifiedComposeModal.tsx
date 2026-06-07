import { useState } from "react";
import { TextInputField } from "../../../components/ui/FormField";
import SearchInput from "../../../components/ui/SearchInput";
import {
  getVendorPreset,
  getVendorPresets,
  type VendorCredentialField,
  type VendorPreset,
} from "../model/vendorPresets";
import { formatShortLabel } from "../model/vendorPresetHelpers";
import { resolveVendorDisplayName } from "../model/vendorIcons";
import {
  buildUnifiedComposeProviderAriaLabel,
  resolveUnifiedComposeFormatTitle,
  resolveUnifiedComposeModalCopy,
} from "../model/unifiedComposeCopy";
import type { ApiKeyFormState, Translator } from "../model/types";
import AccountDetailModalFrame from "./AccountDetailModalFrame";
import {
  AccountDetailBody,
  AccountDetailModuleStack,
  AccountDetailEmptyState,
  AccountDetailNotice,
  AccountDetailPill,
  AccountDetailSection,
} from "./AccountDetailPrimitives";
import {
  AccountCurlEditorModal,
  buildBillingCurlTemplates,
  buildCurlVariables,
  buildQuotaCurlTemplates,
} from "./AccountCurlEditorModal";
import VendorLogoMark from "./VendorLogoMark";

const CATEGORY_ORDER: VendorPreset["category"][] = [
  "official",
  "cn_official",
  "aggregator",
  "third_party",
  "cloud_provider",
];

export interface UnifiedComposeFormState extends ApiKeyFormState {
  formatBaseUrls: Partial<Record<string, string>>;
  billingCurl: string;
  billingEnabled: boolean;
  modelFetchApiKey: string;
  modelFetchBaseUrl: string;
}

interface UnifiedComposeModalProps {
  t: Translator;
  form: UnifiedComposeFormState;
  error: string;
  onClose: () => void;
  onFormChange: (
    field: keyof UnifiedComposeFormState,
    value: string | boolean,
  ) => void;
  onFormatBaseUrlChange: (format: string, value: string) => void;
  onBillingCurlChange: (value: string) => void;
  onBillingEnabledChange: (enabled: boolean) => void;
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
  onBillingEnabledChange,
  onPresetApply,
  onSubmit,
  initialShowPresets = true,
  initialSelectedPresetID = "",
  initialPresetSearch = "",
}: UnifiedComposeModalProps) {
  const presets = getVendorPresets();
  const [presetSearch, setPresetSearch] = useState(initialPresetSearch);
  const [showPresets, setShowPresets] = useState(initialShowPresets);
  const [selectedPresetID, setSelectedPresetID] = useState(
    initialSelectedPresetID,
  );
  const copy = resolveUnifiedComposeModalCopy(t);

  const selectedPreset = selectedPresetID
    ? getVendorPreset(selectedPresetID)
    : undefined;

  const filteredPresets = presetSearch.trim()
    ? presets.filter(
        (p) =>
          p.name.toLowerCase().includes(presetSearch.toLowerCase()) ||
          p.id.toLowerCase().includes(presetSearch.toLowerCase()),
      )
    : presets;

  const presetsByCategory = new Map<VendorPreset["category"], VendorPreset[]>();
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
    setSelectedPresetID("");
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
      error={
        error ? (
          <AccountDetailNotice tone="danger" className="mx-6 mb-4 shrink-0">
            {error}
          </AccountDetailNotice>
        ) : undefined
      }
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
              {Array.from(presetsByCategory.entries()).map(
                ([category, items]) => (
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
                          aria-label={buildUnifiedComposeProviderAriaLabel(
                            t,
                            preset.name,
                          )}
                          className="group grid min-h-[7.25rem] grid-rows-[auto_1fr_auto] overflow-hidden border border-[var(--border-color)] bg-[var(--bg-surface)] px-3 py-3 text-left transition-[border-color,box-shadow,transform] hover:border-[var(--text-primary)] hover:shadow-[4px_4px_0_var(--shadow-color)] active:scale-[0.98]"
                        >
                          <div className="flex min-w-0 items-start justify-between gap-2">
                            <VendorLogoMark preset={preset} />
                            <span className="max-w-[6.75rem] truncate border border-dashed border-[var(--border-color)] px-1.5 py-0.5 text-[length:var(--font-size-ui-3xs)] font-black uppercase tracking-[0.12em] text-[var(--text-muted)]">
                              {copy.categoryLabels[preset.category]}
                            </span>
                          </div>
                          <div className="mt-3 flex min-w-0 items-end">
                            <div className="min-w-0 space-y-1">
                              <div className="truncate text-[length:var(--font-size-ui-lg)] font-black tracking-normal text-[var(--text-primary)]">
                                {preset.name}
                              </div>
                              {preset.variantLabel ? (
                                <div className="inline-flex max-w-full border border-[var(--text-primary)] bg-[var(--text-primary)] px-1.5 py-0.5 text-[length:var(--font-size-ui-3xs)] font-black uppercase tracking-[0.12em] text-[var(--bg-main)]">
                                  <span className="truncate">
                                    {preset.variantLabel}
                                  </span>
                                </div>
                              ) : null}
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
                ),
              )}
            </div>
          </div>
        ) : (
          <AccountDetailModuleStack layout="cards">
            <AccountDetailSection
              componentName="UnifiedComposeCredentialsSection"
              eyebrow={copy.credentialEyebrow}
              title={copy.credentialsLabel}
              span="wide"
            >
              <TextInputField
                title={copy.labelLabel}
                value={form.label}
                onChange={(event) => onFormChange("label", event.target.value)}
                placeholder={labelPlaceholder}
                aria-label={copy.labelLabel}
              />

              <div className="grid gap-4 xl:grid-cols-2">
                <TextInputField
                  title={copy.apiKeyLabel}
                  value={form.apiKey}
                  onChange={(event) =>
                    onFormChange("apiKey", event.target.value)
                  }
                  data-unified-compose-api-key-plaintext="true"
                  placeholder={selectedPreset?.apiKeyPlaceholder ?? "sk-..."}
                  aria-label={copy.apiKeyLabel}
                />
                <TextInputField
                  title={copy.baseUrlPrimaryLabel}
                  value={form.baseUrl}
                  onChange={(event) =>
                    onFormChange("baseUrl", event.target.value)
                  }
                  placeholder={
                    selectedPreset?.baseUrl ??
                    "https://api.example.com/anthropic"
                  }
                  aria-label={copy.baseUrlPrimaryLabel}
                />
              </div>

              {selectedPreset?.notes ? (
                <AccountDetailNotice tone="neutral" className="normal-case">
                  {selectedPreset.notes}
                </AccountDetailNotice>
              ) : null}

            </AccountDetailSection>

            {selectedPreset?.credentialFields?.length ? (
              <UnifiedComposeCredentialFieldsSection
                fields={selectedPreset.credentialFields}
                form={form}
                onFormChange={onFormChange}
              />
            ) : null}

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
                    const fmtBaseUrl =
                      selectedPreset.formatBaseUrls?.[fmt] ??
                      selectedPreset.baseUrl;
                    return (
                      <div
                        key={fmt}
                        className="grid min-w-0 gap-3 border-2 border-[var(--border-color)] bg-[var(--bg-surface)] p-3 xl:grid-cols-[10rem_minmax(0,1fr)] xl:items-end"
                      >
                        <div className="min-w-0 space-y-1">
                          <AccountDetailPill
                            tone="success"
                            className="!min-h-0 !py-0.5 !tracking-[0.12em]"
                          >
                            {formatShortLabel(fmt)}
                          </AccountDetailPill>
                          <div className="truncate text-[length:var(--font-size-ui-2xs)] font-black uppercase tracking-[0.14em] text-[var(--text-muted)]">
                            {copy.formatTargetLabels[fmt]}
                          </div>
                        </div>
                        <TextInputField
                          title={resolveUnifiedComposeFormatTitle(t, fmt)}
                          value={form.formatBaseUrls[fmt] ?? ""}
                          onChange={(event) =>
                            onFormatBaseUrlChange(fmt, event.target.value)
                          }
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

            <UnifiedComposeCurlConfigSection
              kind="quota"
              componentName="UnifiedComposeQuotaSection"
              eyebrow={copy.automationEyebrow}
              title={copy.quotaCurlLabel}
              enabledLabel={copy.quotaTrackingLabel}
              emptyMessage="未配置额度脚本，添加后可在账号详情中测试并展示额度"
              configuredLabel="已配置额度 cURL"
              addLabel="添加"
              editLabel="编辑脚本"
              editorTitle="额度脚本"
              value={form.quotaCurl}
              enabled={form.quotaEnabled}
              baseUrl={form.baseUrl}
              apiKey={form.apiKey}
              prefix={form.prefix}
              platformCookie={form.platformCookie ?? ""}
              placeholder={copy.quotaCurlPlaceholder}
              setupGuide={selectedPreset?.quotaSetupGuide}
              credentialFields={selectedPreset?.credentialFields?.filter((field) => field.scope === "curl") ?? []}
              templates={buildQuotaCurlTemplates(
                form.baseUrl,
                selectedPreset?.quotaCurlTemplate ?? "",
              )}
              onValueChange={(value) => onFormChange("quotaCurl", value)}
              onEnabledChange={(enabled) =>
                onFormChange("quotaEnabled", enabled)
              }
              onApplyTemplate={(template) => {
                onFormChange("quotaCurl", template);
                onFormChange("quotaEnabled", true);
              }}
            />

            {selectedPreset?.billingCurlTemplate || form.billingCurl ? (
              <UnifiedComposeCurlConfigSection
                kind="billing"
                componentName="UnifiedComposeBillingSection"
                eyebrow={copy.billingEyebrow}
                title={copy.billingLabel}
                enabledLabel={copy.billingEnabledLabel}
                emptyMessage="未配置余额脚本，添加后可在账号详情中测试并展示余额"
                configuredLabel="已配置余额 cURL"
                addLabel="添加"
                editLabel="编辑脚本"
                editorTitle="余额脚本"
                value={form.billingCurl}
                enabled={form.billingEnabled}
                baseUrl={form.baseUrl}
                apiKey={form.apiKey}
                prefix={form.prefix}
                platformCookie={form.platformCookie ?? ""}
                placeholder={
                  selectedPreset?.billingCurlTemplate ??
                  'curl -sS "{{baseUrl}}/billing" -H "Authorization: Bearer {{apiKey}}"'
                }
                setupGuide={selectedPreset?.billingSetupGuide}
                credentialFields={selectedPreset?.credentialFields?.filter((field) => field.scope === "curl") ?? []}
                templates={buildBillingCurlTemplates(
                  form.baseUrl,
                  selectedPreset?.billingCurlTemplate ?? "",
                )}
                onValueChange={onBillingCurlChange}
                onEnabledChange={onBillingEnabledChange}
                onApplyTemplate={(template) => {
                  onBillingCurlChange(template);
                  onBillingEnabledChange(true);
                }}
              />
            ) : null}
          </AccountDetailModuleStack>
        )}
      </AccountDetailBody>
    </AccountDetailModalFrame>
  );
}

function UnifiedComposeCredentialFieldsSection({
  fields,
  form,
  onFormChange,
}: {
  fields: VendorCredentialField[];
  form: UnifiedComposeFormState;
  onFormChange: UnifiedComposeModalProps['onFormChange'];
}) {
  const curlFields = fields.filter((field) => field.scope === 'curl');
  const modelFetchFields = fields.filter((field) => field.scope === 'model_fetch');
  return (
    <AccountDetailSection
      componentName="UnifiedComposeCredentialFieldsSection"
      eyebrow="Aux Credentials"
      title="厂商辅助凭据与变量"
      span="wide"
    >
      {curlFields.length ? (
        <CredentialFieldGroup title="cURL 变量" fields={curlFields} form={form} onFormChange={onFormChange} />
      ) : null}
      {modelFetchFields.length ? (
        <CredentialFieldGroup title="模型列表拉取" fields={modelFetchFields} form={form} onFormChange={onFormChange} />
      ) : null}
    </AccountDetailSection>
  );
}

function CredentialFieldGroup({
  title,
  fields,
  form,
  onFormChange,
}: {
  title: string;
  fields: VendorCredentialField[];
  form: UnifiedComposeFormState;
  onFormChange: UnifiedComposeModalProps['onFormChange'];
}) {
  return (
    <section className="grid gap-3">
      <div className="font-mono text-[length:var(--font-size-ui-2xs)] font-black uppercase tracking-[0.18em] text-[var(--text-muted)]">
        {title}
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        {fields.map((field) => (
          <TextInputField
            key={field.id}
            title={field.label}
            value={readUnifiedComposeCredentialField(form, field.id)}
            onChange={(event) => onFormChange(field.id as keyof UnifiedComposeFormState, event.target.value)}
            data-unified-compose-api-key-plaintext={field.secret ? "true" : undefined}
            placeholder={field.placeholder}
            aria-label={field.label}
          />
        ))}
      </div>
      {fields.map((field) => field.help ? (
        <div key={`${field.id}-help`} className="text-[length:var(--font-size-ui-2xs)] font-black uppercase tracking-[0.14em] text-[var(--text-muted)]">
          {field.help}
        </div>
      ) : null)}
    </section>
  );
}

function readUnifiedComposeCredentialField(form: UnifiedComposeFormState, fieldID: VendorCredentialField['id']) {
  switch (fieldID) {
    case 'platformCookie':
      return form.platformCookie ?? '';
    case 'modelFetchApiKey':
      return form.modelFetchApiKey ?? '';
    case 'modelFetchBaseUrl':
      return form.modelFetchBaseUrl ?? '';
    default:
      return '';
  }
}


interface UnifiedComposeCurlConfigSectionProps {
  kind: "quota" | "billing";
  componentName: string;
  eyebrow: string;
  title: string;
  enabledLabel: string;
  emptyMessage: string;
  configuredLabel: string;
  addLabel: string;
  editLabel: string;
  editorTitle: string;
  value: string;
  enabled: boolean;
  baseUrl: string;
  apiKey: string;
  prefix: string;
  platformCookie: string;
  placeholder: string;
  setupGuide?: string[];
  credentialFields: VendorCredentialField[];
  templates: Array<{
    id: string;
    title: string;
    body: string;
    description: string;
  }>;
  onValueChange: (value: string) => void;
  onEnabledChange: (enabled: boolean) => void;
  onApplyTemplate: (template: string) => void;
}

function UnifiedComposeCurlConfigSection({
  kind,
  componentName,
  eyebrow,
  title,
  enabledLabel,
  emptyMessage,
  configuredLabel,
  addLabel,
  editLabel,
  editorTitle,
  value,
  enabled,
  baseUrl,
  apiKey,
  prefix,
  platformCookie = "",
  placeholder,
  setupGuide,
  credentialFields,
  templates,
  onValueChange,
  onEnabledChange,
  onApplyTemplate,
}: UnifiedComposeCurlConfigSectionProps) {
  const [editorOpen, setEditorOpen] = useState(false);
  const hasScript = value.trim().length > 0;
  const variables = buildCurlVariables({
    label: "",
    apiKey,
    baseUrl,
    formatBaseUrls: {},
    prefix,
    models: [],
    quotaCurl: "",
    quotaEnabled: false,
    platformCookie: platformCookie ?? "",
    billingCurl: "",
    billingEnabled: false,
    proxyUrl: "",
  }, credentialFields);

  return (
    <AccountDetailSection
      componentName={componentName}
      eyebrow={eyebrow}
      title={title}
      actions={
        <button
          type="button"
          onClick={() => setEditorOpen(true)}
          className="btn-swiss !text-[length:var(--font-size-ui-2xs)]"
        >
          {hasScript ? editLabel : addLabel}
        </button>
      }
      muted={!hasScript}
    >
      {hasScript ? (
        <div
          data-unified-compose-curl-card={kind}
          className="grid gap-3 border-2 border-[var(--border-color)] bg-[var(--bg-surface)] p-3"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={enabled}
                onChange={(event) => onEnabledChange(event.target.checked)}
              />
              <span className="text-[length:var(--font-size-ui-2xs)] font-black uppercase tracking-[0.18em] text-[var(--text-muted)]">
                {enabledLabel}
              </span>
            </label>
            <span className="font-mono text-[length:var(--font-size-ui-2xs)] font-black uppercase tracking-[0.18em] text-[var(--text-muted)]">
              {configuredLabel}
            </span>
          </div>
          <div
            className="truncate font-mono text-[length:var(--font-size-ui-xs)] text-[var(--text-muted)]"
            title={value || undefined}
          >
            {value}
          </div>
        </div>
      ) : (
        <AccountDetailEmptyState className="py-4 text-left !text-[length:var(--font-size-ui-xs)] !tracking-[0.08em]">
          {emptyMessage}
        </AccountDetailEmptyState>
      )}

      {editorOpen ? (
        <AccountCurlEditorModal
          title={editorTitle}
          value={value}
          enabled={enabled}
          variables={variables}
          templates={templates}
          placeholder={placeholder}
          setupGuide={setupGuide}
          onValueChange={onValueChange}
          onEnabledChange={onEnabledChange}
          onApplyTemplate={onApplyTemplate}
          onClose={() => setEditorOpen(false)}
        />
      ) : null}
    </AccountDetailSection>
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
  const primaryTitle =
    selectedPreset && !showPresets
      ? selectedPreset.name
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
          {selectedPreset && !showPresets ? (
            <VendorLogoMark preset={selectedPreset} />
          ) : null}
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
                    {selectedPreset.variantLabel ? (
                      <AccountDetailPill
                        tone="success"
                        className="!min-h-0 !py-0.5 !tracking-[0.12em]"
                      >
                        {selectedPreset.variantLabel}
                      </AccountDetailPill>
                    ) : null}
                    {selectedPreset.supportedFormats.map((fmt) => (
                      <AccountDetailPill
                        key={fmt}
                        className="!min-h-0 !py-0.5 !tracking-[0.12em]"
                      >
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
          <button
            type="button"
            onClick={onBackToPresets}
            className="btn-swiss shrink-0 !px-3 !py-2 !text-[length:var(--font-size-ui-xs)]"
          >
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
        {t("common.cancel")}
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
