import { useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import type { AccountRecord, ApiFormat, BillingDisplay } from '../../../types';
import { useI18n } from '../../../context/I18nContext';
import { toErrorMessage } from '../../../utils/error';
import {
  buildBillingCurlSetupGuide,
  buildBillingCurlTemplate,
  buildQuotaCurlSetupGuide,
  buildQuotaCurlTemplate,
  buildVendorCredentialFields,
  buildVendorCurlVariableFields,
  type ApiKeyConfigDraft,
} from '../model/accountDetailConfig';
import {
  buildProxyURLFromNode,
  readStoredProxyNodes,
  type ProxyNodeRecord,
} from '../../proxy-pool/model.ts';
import {
  buildAccountProxyRouteDraft,
  formatAccountProxySummary,
  type AccountProxyRouteDraft,
} from '../model/accountProxyRoute.ts';
import { buildQuotaDisplay, normalizeQuotaTestDisplay, selectQuotaWindows } from '../model/accountQuota';
import type { AccountUsageSummary } from '../model/accountUsage';
import type { CodexQuotaState, QuotaDisplay } from '../model/types';
import { formatLabel } from '../model/vendorPresetHelpers';
import type { VendorCredentialField } from '../model/vendorPresets';
import { QuotaBars } from './CardSections';
import {
  AccountDetailEmptyState,
  AccountDetailPill,
  AccountDetailSection,
  type AccountDetailSectionSpan,
} from './AccountDetailPrimitives';
import { AccountProxyRouteEditor } from './AccountProxyRouteSection';
import {
  AccountCurlEditorModal,
  buildBillingCurlTemplates,
  buildCurlVariables,
  buildQuotaCurlTemplates,
} from './AccountCurlEditorModal';

export interface APIKeyVerifyState {
  model: string;
  status: 'idle' | 'loading' | 'success' | 'error';
  message: string;
  lastVerifiedAt: number | null;
}

export interface AccountDetailHeaderProps {
  account: AccountRecord;
  usageSummary?: AccountUsageSummary;
  onRename?: (nextName: string) => void;
  onStartReauth?: () => void;
  onCancelReauth?: () => void;
  isReauthing?: boolean;
}

export interface AccountCredentialVerifySectionProps {
  draft: ApiKeyConfigDraft;
  setDraft: Dispatch<SetStateAction<ApiKeyConfigDraft>>;
  verifyState?: APIKeyVerifyState;
  modelNames?: string[];
  span?: AccountDetailSectionSpan;
  onVerify?: (input: { apiKey: string; baseUrl: string; model: string }) => void;
  onProxyValidityChange?: (message: string) => void;
}

interface VerifyConnectionPanelProps {
  draft: ApiKeyConfigDraft;
  verifyState?: APIKeyVerifyState;
  modelNames?: string[];
  onVerify?: (input: { apiKey: string; baseUrl: string; model: string }) => void;
}

type AccountQuotaLayoutMode = 'split' | 'stack';

export interface AccountQuotaSectionProps {
  account: AccountRecord;
  draft: ApiKeyConfigDraft;
  setDraft: Dispatch<SetStateAction<ApiKeyConfigDraft>>;
  quotaState?: CodexQuotaState;
  quotaDisplay?: QuotaDisplay;
  readOnlyScripts?: boolean;
  editorOpen?: boolean;
  onOpenEditor?: () => void;
  onCloseEditor?: () => void;
  onTestQuotaCurl?: (input: { apiKey: string; baseUrl: string; prefix: string; quotaCurl: string; platformCookie?: string; curlVariables?: Record<string, string> }) => Promise<any>;
  topBorder?: boolean;
  headerDivider?: boolean;
  layoutMode?: AccountQuotaLayoutMode;
}

export interface AccountBillingSectionProps {
  account: AccountRecord;
  draft: ApiKeyConfigDraft;
  setDraft: Dispatch<SetStateAction<ApiKeyConfigDraft>>;
  liveBilling?: BillingDisplay;
  readOnlyScripts?: boolean;
  editorOpen?: boolean;
  onOpenEditor?: () => void;
  onCloseEditor?: () => void;
  onTestBillingCurl?: (input: { apiKey: string; baseUrl: string; prefix: string; billingCurl: string; platformCookie?: string; curlVariables?: Record<string, string> }) => Promise<any>;
  topBorder?: boolean;
  headerDivider?: boolean;
}

export interface AccountDetailFooterProps {
  isApiKey: boolean;
  configDirty: boolean;
  rateLimitDirty?: boolean;
  missingFields: string[];
  savingConfig: boolean;
  onClose: () => void;
  onSaveConfig: () => void;
}

const DEFAULT_VERIFY_MODEL = 'gpt-5.4-mini';

export function AccountDetailHeader({
  account,
}: AccountDetailHeaderProps) {
  const accountTypeLabel = resolveAccountHeaderTypeLabel(account);
  const credentialLabel = account.credentialSource === 'auth-file'
    ? 'Database OAuth'
    : account.provider === 'codex'
      ? 'Codex Key'
      : 'API Key';
  const routeLabel = account.proxyUrl ? 'Proxy Node' : 'Default Route';
  const balanceLabel = account.credentialSource === 'auth-file' ? 'Provider' : 'Configured';
  const description = account.credentialSource === 'auth-file'
    ? 'Database-managed OAuth account · config preview/apply · provider managed quota'
    : account.provider === 'codex'
      ? 'Codex API key account · prefix · short-message verification · quota/billing scripts'
      : 'API Key provider · custom headers · model mapping · short-message verification';

  return (
    <div data-account-detail-header="v09-compact" className="grid min-w-0 grid-cols-[10.5rem_minmax(0,1fr)] bg-[var(--bg-surface)]">
      <div data-account-detail-header-account-type="true" className="flex min-w-0 items-center border-r-2 border-[var(--border-color)] px-4 py-3">
        <div className="w-full min-w-0 text-left text-base font-black uppercase italic leading-tight tracking-tight">
          <span className="block whitespace-normal break-words [overflow-wrap:break-word]">{accountTypeLabel}</span>
        </div>
      </div>

      <div className="grid min-w-0 content-center gap-1 px-2.5 py-2">
        <div data-account-detail-header-chips="true" className="flex min-w-0 items-center gap-1.5 overflow-hidden">
          <AccountDetailPill className="!min-h-0 !border-2 !bg-[var(--text-primary)] !py-1 !text-[length:var(--font-size-ui-2xs)] !text-[var(--bg-main)]">类型: {account.credentialSource === 'auth-file' ? 'Codex Auth-file / OAuth' : account.provider === 'codex' ? 'Codex API Key' : 'OpenAI-compatible'}</AccountDetailPill>
          <AccountDetailPill className="!min-h-0 !border-2 !py-1 !text-[length:var(--font-size-ui-2xs)]">凭据: {credentialLabel}</AccountDetailPill>
          <AccountDetailPill className="!min-h-0 !border-2 !py-1 !text-[length:var(--font-size-ui-2xs)]">验证: Short Message</AccountDetailPill>
          <AccountDetailPill className="!min-h-0 !border-2 !py-1 !text-[length:var(--font-size-ui-2xs)]">路由: {routeLabel}</AccountDetailPill>
          <AccountDetailPill className="!min-h-0 !border-2 !py-1 !text-[length:var(--font-size-ui-2xs)]">余额/额度: {balanceLabel}</AccountDetailPill>
        </div>
        <div data-account-detail-header-description="true" className="flex min-w-0 items-center pl-0.5 font-mono text-[length:var(--font-size-ui-xs)] font-black leading-tight text-[var(--text-muted)]">
          <span className="truncate">{description}</span>
        </div>
      </div>
    </div>
  );
}

function resolveAccountHeaderTypeLabel(account: AccountRecord) {
  if (account.credentialSource === 'auth-file') {
    return 'CODEX OAUTH';
  }
  if (account.provider === 'codex' || account.accountKind === 'codex-api-key') {
    return 'CODEX API KEY';
  }
  return 'OPENAI COMPATIBLE';
}

export function AccountCredentialVerifySection({
  draft,
  setDraft,
  verifyState,
  modelNames,
  span,
  onVerify,
  onProxyValidityChange,
}: AccountCredentialVerifySectionProps) {
  const credentialFields = useMemo(
    () => buildVendorCredentialFields({ displayName: '', provider: '', baseUrl: draft.baseUrl }),
    [draft.baseUrl],
  );

  return (
    <AccountDetailSection
      componentName="AccountCredentialVerifySection"
      eyebrow="Credential / Connection"
      title="凭据与验证"
      span={span}
    >
      <div data-account-credential-verify-layout="v09-split" className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div data-account-credential-left-pane="credential-connection" className="grid content-start gap-4 lg:pr-4">
          <section data-account-credential-list-item="credential" className="grid content-start gap-3">
            <div className="font-mono text-[length:var(--font-size-ui-2xs)] font-black uppercase tracking-[0.18em] text-[var(--text-muted)]">
              CREDENTIAL
            </div>
            <div data-account-credential-fields="balanced-grid" className="grid gap-3">
              <CredentialInputField
                label="账号名称"
                value={draft.label}
                onChange={(value) => setDraft((prev) => ({ ...prev, label: value }))}
              />
              <CredentialInputField
                label="API 密钥"
                value={draft.apiKey}
                onChange={(value) => setDraft((prev) => ({ ...prev, apiKey: value }))}
                onCopy={() => void navigator.clipboard.writeText(draft.apiKey)}
              />
              <CredentialInputField
                label="基础 URL"
                value={draft.baseUrl}
                onChange={(value) => setDraft((prev) => ({ ...prev, baseUrl: value }))}
                onCopy={() => void navigator.clipboard.writeText(draft.baseUrl)}
              />
              <CredentialInputField
                label="前缀"
                value={draft.prefix}
                placeholder="/v1"
                onChange={(value) => setDraft((prev) => ({ ...prev, prefix: value }))}
              />
              {credentialFields.map((field) => (
                <VendorCredentialInputField
                  key={field.id}
                  field={field}
                  draft={draft}
                  onChange={(value) => setDraft((prev) => writeDraftCredentialField(prev, field.id, value))}
                />
              ))}
            </div>
          </section>

          <VerifyConnectionPanel
            draft={draft}
            verifyState={verifyState}
            modelNames={modelNames}
            onVerify={onVerify}
          />
        </div>

        <div data-account-credential-right-pane="route" className="grid min-w-0 content-start border-t-2 border-[var(--border-color)] pt-4 lg:border-l-2 lg:border-t-0 lg:pl-4 lg:pt-0">
          <CredentialProxyRoutePanel
            proxyUrl={draft.proxyUrl}
            onProxyUrlChange={(nextProxyURL) => setDraft((prev) => ({ ...prev, proxyUrl: nextProxyURL }))}
            onValidityChange={onProxyValidityChange}
          />
        </div>
      </div>
    </AccountDetailSection>
  );
}

function CredentialProxyRoutePanel({
  proxyUrl,
  onProxyUrlChange,
  onValidityChange,
}: {
  proxyUrl?: string;
  onProxyUrlChange?: (proxyUrl: string) => void;
  onValidityChange?: (message: string) => void;
}) {
  const { t } = useI18n();
  const [storedProxyNodes, setStoredProxyNodes] = useState<ProxyNodeRecord[]>(() => readCredentialProxyNodes());
  const [draft, setDraft] = useState<AccountProxyRouteDraft>(() =>
    buildAccountProxyRouteDraft({ id: 'account-credential-proxy-route', proxyUrl }, storedProxyNodes),
  );

  useEffect(() => {
    setDraft(buildAccountProxyRouteDraft({ id: 'account-credential-proxy-route', proxyUrl }, storedProxyNodes));
  }, [storedProxyNodes, proxyUrl]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    function refreshProxyNodes() {
      setStoredProxyNodes(readCredentialProxyNodes());
    }
    window.addEventListener('storage', refreshProxyNodes);
    window.addEventListener('focus', refreshProxyNodes);
    return () => {
      window.removeEventListener('storage', refreshProxyNodes);
      window.removeEventListener('focus', refreshProxyNodes);
    };
  }, []);

  const proxyOptions = useMemo(
    () =>
      storedProxyNodes
        .map((node) => ({
          node,
          proxyUrl: buildProxyURLFromNode(node),
        }))
        .sort((a, b) => {
          if (a.node.status !== b.node.status) {
            return a.node.status === 'available' ? -1 : 1;
          }
          return a.node.latencyMs - b.node.latencyMs;
        }),
    [storedProxyNodes],
  );
  const summary = useMemo(() => formatAccountProxySummary(draft.proxyUrl, storedProxyNodes), [draft.proxyUrl, storedProxyNodes]);
  const customMissing = draft.mode === 'custom' && !draft.proxyUrl.trim();
  const hasDetachedCurrentURL = Boolean(
    draft.proxyUrl && !proxyOptions.some((item) => item.proxyUrl === draft.proxyUrl),
  );

  useEffect(() => {
    onValidityChange?.(customMissing ? t('accounts.proxy_route_invalid') : '');
  }, [customMissing, onValidityChange, t]);

  function commitDraft(nextDraft: AccountProxyRouteDraft, shouldCommitURL: boolean) {
    setDraft(nextDraft);
    if (shouldCommitURL) {
      onProxyUrlChange?.(nextDraft.proxyUrl);
    }
  }

  function selectProxy(nextProxyURL: string) {
    const selected = proxyOptions.find((item) => item.proxyUrl === nextProxyURL);
    commitDraft(
      {
        mode: 'custom',
        proxyNodeID: selected?.node.id || '',
        proxyUrl: nextProxyURL,
      },
      true,
    );
  }

  return (
    <section data-account-credential-list-item="proxy-route" className="grid gap-3 pt-4">
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
        <div>
          <div className="font-mono text-[length:var(--font-size-ui-2xs)] font-black uppercase tracking-[0.18em] text-[var(--text-muted)]">
            ROUTE
          </div>
          <div className="mt-1 text-[length:var(--font-size-ui-xs)] font-black uppercase italic tracking-[0.06em] text-[var(--text-primary)]">
            {t('accounts.proxy_route_title')}
          </div>
        </div>
        <AccountDetailPill className="!border-2 !text-[var(--text-primary)]">
          {summary.label}
        </AccountDetailPill>
      </div>

      <AccountProxyRouteEditor
        draft={draft}
        proxyOptions={proxyOptions}
        hasDetachedCurrentURL={hasDetachedCurrentURL}
        onProxySelect={selectProxy}
      />
    </section>
  );
}

function readCredentialProxyNodes(): ProxyNodeRecord[] {
  if (typeof window === 'undefined') {
    return [];
  }
  return readStoredProxyNodes(window.localStorage);
}

function VendorCredentialInputField({
  field,
  draft,
  onChange,
}: {
  field: VendorCredentialField;
  draft: ApiKeyConfigDraft;
  onChange: (value: string) => void;
}) {
  return (
    <CredentialInputField
      label={field.label}
      value={readDraftCredentialField(draft, field.id)}
      placeholder={field.placeholder}
      onChange={onChange}
      secret={field.secret}
      help={field.help}
    />
  );
}

function readDraftCredentialField(draft: ApiKeyConfigDraft, fieldID: VendorCredentialField['id']) {
  if (fieldID === 'platformCookie') {
    return draft.platformCookie ?? draft.curlVariables?.platformCookie ?? '';
  }
  return draft.curlVariables?.[fieldID] ?? '';
}

function writeDraftCredentialField(draft: ApiKeyConfigDraft, fieldID: VendorCredentialField['id'], value: string): ApiKeyConfigDraft {
  const nextVariables = { ...(draft.curlVariables ?? {}), [fieldID]: value };
  if (fieldID === 'platformCookie') {
    return { ...draft, platformCookie: value, curlVariables: nextVariables };
  }
  return { ...draft, curlVariables: nextVariables };
}

function CredentialInputField({
  label,
  value,
  placeholder,
  onChange,
  onCopy,
  secret: _secret,
  help,
  className = 'md:col-span-12',
}: {
  label: string;
  value: string;
  placeholder?: string;
  onChange: (value: string) => void;
  onCopy?: () => void;
  secret?: boolean;
  help?: string;
  className?: string;
}) {
  return (
    <label data-account-credential-field="plaintext" className={`grid min-w-0 gap-1.5 ${className}`}>
      <span
        data-account-credential-field-label="above"
        className="font-mono text-[length:var(--font-size-ui-2xs)] font-black uppercase tracking-[0.18em] text-[var(--text-muted)]"
      >
        {label}
      </span>
      <div className="flex min-w-0 items-center gap-2">
        <input
          type="text"
          value={value}
          placeholder={placeholder}
          onChange={(event) => onChange(event.target.value)}
          className="input-swiss min-w-0 flex-1 font-mono !text-[length:var(--font-size-ui-xs)]"
        />
        {onCopy ? (
          <button
            type="button"
            onClick={onCopy}
            className="btn-swiss shrink-0 !px-3 !py-2 !text-[length:var(--font-size-ui-2xs)]"
          >
            复制
          </button>
        ) : null}
      </div>
      {help ? (
        <span className="text-[length:var(--font-size-ui-2xs)] font-bold leading-relaxed text-[var(--text-muted)]">
          {help}
        </span>
      ) : null}
    </label>
  );
}

function VerifyConnectionPanel({
  draft,
  verifyState,
  modelNames,
  onVerify,
}: VerifyConnectionPanelProps) {
  const [verifyModel, setVerifyModel] = useState(DEFAULT_VERIFY_MODEL);
  const modelMenuRef = useRef<HTMLDivElement | null>(null);
  const [isModelMenuOpen, setIsModelMenuOpen] = useState(false);
  const [modelMenuMode, setModelMenuMode] = useState<'all' | 'custom'>('all');

  useEffect(() => {
    if (verifyState?.model) {
      setVerifyModel(verifyState.model);
    }
  }, [verifyState?.model]);

  const displayedModelNames = useMemo(() => {
    if (!modelNames || modelNames.length === 0) return [];
    if (modelMenuMode === 'all') return modelNames;
    return modelNames.filter((name) => name.toLowerCase().includes(verifyModel.toLowerCase()));
  }, [modelMenuMode, modelNames, verifyModel]);

  const vs = verifyState ?? {
    model: verifyModel,
    status: 'idle' as const,
    message: '',
    lastVerifiedAt: null,
  };

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!modelMenuRef.current?.contains(event.target as Node)) {
        setIsModelMenuOpen(false);
      }
    }
    if (isModelMenuOpen) {
      window.addEventListener('mousedown', handlePointerDown);
      return () => window.removeEventListener('mousedown', handlePointerDown);
    }
  }, [isModelMenuOpen]);

  return (
    <section data-account-credential-list-item="connection" className="grid gap-3 border-t-2 border-[var(--border-color)] pt-4">
      <div className="font-mono text-[length:var(--font-size-ui-2xs)] font-black uppercase tracking-[0.18em] text-[var(--text-muted)]">
        CONNECTION
      </div>
      <div className="text-[length:var(--font-size-ui-xs)] font-black uppercase tracking-[0.12em] text-[var(--text-primary)]">
        短消息验证
      </div>
      {vs.lastVerifiedAt ? (
        <div className="text-[length:var(--font-size-ui-2xs)] font-bold uppercase tracking-[0.12em] text-[var(--text-muted)]">
          上次发送：{new Date(vs.lastVerifiedAt).toLocaleString()}
        </div>
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div ref={modelMenuRef} className="relative flex-1">
          <div className="flex items-center gap-2">
            <input
              value={verifyModel}
              onChange={(event) => {
                setVerifyModel(event.target.value);
                setModelMenuMode('custom');
              }}
              onFocus={() => setIsModelMenuOpen(true)}
              className="input-swiss flex-1 font-mono !text-[length:var(--font-size-ui-xs)]"
              placeholder={DEFAULT_VERIFY_MODEL}
            />
            {modelNames && modelNames.length > 0 ? (
              <button onClick={() => setIsModelMenuOpen((prev) => !prev)} className="btn-swiss !px-2 !py-1 !text-[length:var(--font-size-ui-2xs)]">
                ▼
              </button>
            ) : null}
          </div>
          {isModelMenuOpen && displayedModelNames.length > 0 ? (
            <div className="absolute left-0 top-full z-20 mt-1 max-h-48 w-full overflow-auto border-2 border-[var(--border-color)] bg-[var(--bg-main)] shadow-hard">
              {displayedModelNames.map((name) => (
                <button
                  key={name}
                  onClick={() => {
                    setVerifyModel(name);
                    setIsModelMenuOpen(false);
                  }}
                  className={`block w-full px-3 py-1.5 text-left text-[length:var(--font-size-ui-xs)] font-black uppercase tracking-[0.12em] transition-colors ${
                    verifyModel === name
                      ? 'bg-[var(--text-primary)] text-[var(--bg-main)]'
                      : 'text-[var(--text-primary)] hover:bg-[var(--bg-surface)]'
                  }`}
                >
                  {name}
                </button>
              ))}
            </div>
          ) : null}
        </div>

        <button
          onClick={() => onVerify?.({ apiKey: draft.apiKey, baseUrl: draft.baseUrl, model: verifyModel })}
          disabled={vs.status === 'loading'}
          className="btn-swiss whitespace-nowrap !text-[length:var(--font-size-ui-xs)]"
        >
          {vs.status === 'loading' ? '发送中...' : '发送验证'}
        </button>
      </div>

      <div className="text-[length:var(--font-size-ui-2xs)] font-bold uppercase tracking-[0.12em] text-[var(--text-muted)]">
        短消息内容：请回复 OK，用于连通性验证 · send one short chat message only
      </div>

      {vs.status !== 'idle' ? (
        <div className={`text-[length:var(--font-size-ui-xs)] font-black uppercase tracking-wide ${
          vs.status === 'success' ? 'text-[var(--color-status-success)]' : vs.status === 'error' ? 'text-[var(--color-status-danger)]' : 'text-[var(--text-muted)]'
        }`}>
          {vs.status === 'loading' ? 'sending short message…' : vs.message}
        </div>
      ) : null}
    </section>
  );
}

export function AccountQuotaSection({
  account,
  draft,
  setDraft,
  quotaState,
  quotaDisplay,
  readOnlyScripts = false,
  editorOpen: routedEditorOpen,
  onOpenEditor,
  onCloseEditor,
  onTestQuotaCurl,
  topBorder = true,
  headerDivider = true,
  layoutMode = 'split',
}: AccountQuotaSectionProps) {
  const { t } = useI18n();
  const [localEditorOpen, setLocalEditorOpen] = useState(false);
  const [testStatus, setTestStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [testMessage, setTestMessage] = useState('');
  const [testResult, setTestResult] = useState<any>(null);
  const liveWindows = quotaState?.quota ? selectQuotaWindows(quotaState.quota) : [];
  const runtimeQuotaDisplay = useMemo(() => buildQuotaDisplay({
    ...account,
    quotaEnabled: draft.quotaEnabled,
    quotaCurl: draft.quotaCurl,
    billingEnabled: draft.billingEnabled,
    billingCurl: draft.billingCurl,
  }, quotaState), [account, draft.quotaEnabled, draft.quotaCurl, draft.billingEnabled, draft.billingCurl, quotaState]);
  const testQuotaDisplay = useMemo(() => normalizeQuotaTestDisplay(testResult), [testResult]);
  const visibleQuotaDisplay = quotaDisplay?.windows?.length
    ? quotaDisplay
    : runtimeQuotaDisplay.windows.length
      ? runtimeQuotaDisplay
      : testQuotaDisplay;
  const visibleQuotaSource = quotaDisplay?.windows?.length || runtimeQuotaDisplay.windows.length ? 'runtime' : testQuotaDisplay ? 'test' : 'empty';
  const visibleQuotaWindows = visibleQuotaDisplay?.windows ?? [];
  const quotaTemplate = useMemo(
    () => buildQuotaCurlTemplate({
      displayName: account.displayName,
      provider: account.provider,
      baseUrl: draft.baseUrl,
    }),
    [account.displayName, account.provider, draft.baseUrl],
  );
  const quotaTemplates = useMemo(
    () => buildQuotaCurlTemplates(draft.baseUrl, quotaTemplate),
    [draft.baseUrl, quotaTemplate],
  );
  const quotaSetupGuide = useMemo(
    () => buildQuotaCurlSetupGuide({
      displayName: account.displayName,
      provider: account.provider,
      baseUrl: draft.baseUrl,
    }),
    [account.displayName, account.provider, draft.baseUrl],
  );
  const quotaCurlVariableFields = useMemo(
    () => buildVendorCurlVariableFields({
      displayName: account.displayName,
      provider: account.provider,
      baseUrl: draft.baseUrl,
    }),
    [account.displayName, account.provider, draft.baseUrl],
  );
  const editorOpen = routedEditorOpen ?? localEditorOpen;
  const hasQuotaScript = draft.quotaCurl.trim().length > 0;
  const quotaLayoutClassName = layoutMode === 'split'
    ? 'grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]'
    : 'grid min-w-0 gap-3';
  const quotaScriptPaneClassName = layoutMode === 'split'
    ? 'grid min-w-0 grid-rows-[auto_minmax(0,1fr)] gap-3 self-stretch border-t-2 border-[var(--border-color)] pt-4 lg:border-l-2 lg:border-t-0 lg:pl-4 lg:pt-0'
    : 'grid min-w-0 content-start gap-3 border-t-2 border-[var(--border-color)] pt-3';
  const quotaScriptCardClassName = layoutMode === 'split'
    ? 'grid h-full min-h-[8.75rem] content-start gap-3 border-2 border-[var(--border-color)] bg-[var(--bg-surface)] p-3'
    : 'grid gap-3 border-2 border-[var(--border-color)] bg-[var(--bg-surface)] p-3';

  function openEditor() {
    if (onOpenEditor) {
      onOpenEditor();
      return;
    }
    setLocalEditorOpen(true);
  }

  function closeEditor() {
    if (onCloseEditor) {
      onCloseEditor();
      return;
    }
    setLocalEditorOpen(false);
  }

  useEffect(() => {
    setTestStatus('idle');
    setTestMessage('');
    setTestResult(null);
  }, [account.id]);

  async function runQuotaTest() {
    if (!onTestQuotaCurl || !draft.quotaCurl.trim()) return;
    setTestStatus('loading');
    setTestMessage('');
    try {
      const result = await onTestQuotaCurl({
        apiKey: draft.apiKey,
        baseUrl: draft.baseUrl,
        prefix: draft.prefix,
        quotaCurl: draft.quotaCurl.trim(),
        platformCookie: (draft.platformCookie ?? "").trim(),
        curlVariables: draft.curlVariables,
      });
      setTestResult(result);
      setTestStatus('success');
    } catch (error) {
      setTestMessage(toErrorMessage(error));
      setTestStatus('error');
    }
  }

  const quotaActions = readOnlyScripts ? undefined : (
    <>
      {hasQuotaScript ? (
        <button type="button" onClick={openEditor} className="btn-swiss !text-[length:var(--font-size-ui-2xs)]">
          编辑脚本
        </button>
      ) : null}
      <button
        type="button"
        onClick={runQuotaTest}
        disabled={testStatus === 'loading' || !hasQuotaScript || !onTestQuotaCurl}
        className="btn-swiss !text-[length:var(--font-size-ui-2xs)]"
      >
        {testStatus === 'loading' ? '测试中...' : '测试'}
      </button>
      {!hasQuotaScript ? (
        <button
          type="button"
          onClick={openEditor}
          className="btn-swiss !text-[length:var(--font-size-ui-2xs)]"
        >
          添加
        </button>
      ) : null}
    </>
  );

  return (
    <AccountDetailSection
      componentName="AccountQuotaSection"
      eyebrow="Quota"
      title="额度追踪"
      meta={visibleQuotaSource === 'runtime' ? `实时 ${visibleQuotaWindows.length || liveWindows.length} 个窗口` : testQuotaDisplay ? `测试 ${testQuotaDisplay.windows.length} 个窗口` : undefined}
      actions={quotaActions}
      topBorder={topBorder}
      headerDivider={headerDivider}
    >

      <div data-account-quota-layout={layoutMode} className={quotaLayoutClassName}>
        <div data-account-quota-pane="windows" className="grid min-w-0 content-start gap-3">
          {visibleQuotaWindows.length > 0 ? (
            <div className="grid gap-2">
              <div className="font-mono text-[length:var(--font-size-ui-2xs)] font-black uppercase tracking-[0.18em] text-[var(--text-muted)]">
                {visibleQuotaSource === 'test' ? 'QUOTA (TEST)' : 'QUOTA'}
              </div>
              {visibleQuotaDisplay ? <QuotaBars quotaDisplay={visibleQuotaDisplay} t={t} showDivider={false} /> : null}
            </div>
          ) : (
            <AccountDetailEmptyState className="!border-0 !bg-transparent px-0 py-4 text-left !text-[length:var(--font-size-ui-xs)] !tracking-[0.08em]">
              {readOnlyScripts
                ? '暂无额度数据'
                : hasQuotaScript ? '暂无额度数据，可测试额度脚本确认接口返回' : '暂无额度脚本，添加后可测试并展示额度'}
            </AccountDetailEmptyState>
          )}

          {testStatus === 'success' && testResult ? (
            <div className="text-[length:var(--font-size-ui-xs)] font-black uppercase text-[var(--color-status-success)]">
              OK - {testResult.planType ?? 'quota'} {testResult.windows?.length ? `${testResult.windows.length} windows` : ''}
            </div>
          ) : null}
          {testStatus === 'error' ? (
            <div className="text-[length:var(--font-size-ui-xs)] font-black uppercase text-[var(--color-status-danger)]">{testMessage}</div>
          ) : null}
        </div>

        <aside data-account-quota-pane="script" className={quotaScriptPaneClassName}>
          <div className="font-mono text-[length:var(--font-size-ui-2xs)] font-black uppercase tracking-[0.18em] text-[var(--text-muted)]">
            SCRIPT
          </div>
          {hasQuotaScript ? (
            <div className={quotaScriptCardClassName}>
              <div
                data-account-quota-script-preview="two-line"
                className="line-clamp-2 min-h-[2.75rem] overflow-hidden break-all font-mono text-[length:var(--font-size-ui-xs)] leading-[1.35rem] text-[var(--text-muted)]"
                title={draft.quotaCurl || undefined}
              >
                {draft.quotaCurl || '未配置额度脚本'}
              </div>
            </div>
          ) : (
            <div className="border-2 border-dashed border-[var(--border-color)] bg-[var(--bg-surface)] px-3 py-4 text-[length:var(--font-size-ui-xs)] font-black uppercase tracking-[0.08em] text-[var(--text-muted)]">
              暂无额度脚本
            </div>
          )}
        </aside>
      </div>

      {editorOpen ? (
        <AccountCurlEditorModal
          title="额度脚本"
          value={draft.quotaCurl}
          enabled={draft.quotaEnabled}
          variables={buildCurlVariables(draft, quotaCurlVariableFields)}
          templates={quotaTemplates}
          placeholder='curl -sS "{{baseUrl}}/usage" -H "Authorization: Bearer {{apiKey}}"'
          setupGuide={quotaSetupGuide}
          onValueChange={(value) => setDraft((prev) => ({ ...prev, quotaCurl: value }))}
          onEnabledChange={(enabled) => setDraft((prev) => ({ ...prev, quotaEnabled: enabled }))}
          onApplyTemplate={(template) => setDraft((prev) => ({ ...prev, quotaCurl: template, quotaEnabled: true }))}
          onClose={closeEditor}
        />
      ) : null}
    </AccountDetailSection>
  );
}

export function AccountBillingSection({
  account,
  draft,
  setDraft,
  liveBilling,
  readOnlyScripts = false,
  editorOpen: routedEditorOpen,
  onOpenEditor,
  onCloseEditor,
  onTestBillingCurl,
  topBorder = true,
  headerDivider = true,
}: AccountBillingSectionProps) {
  const [localEditorOpen, setLocalEditorOpen] = useState(false);
  const [testStatus, setTestStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [testMessage, setTestMessage] = useState('');
  const [testBilling, setTestBilling] = useState<BillingDisplay | undefined>(undefined);
  const billingTemplate = useMemo(
    () => buildBillingCurlTemplate({
      displayName: account.displayName,
      provider: account.provider,
      baseUrl: draft.baseUrl,
    }),
    [account.displayName, account.provider, draft.baseUrl],
  );
  const billingTemplates = useMemo(
    () => buildBillingCurlTemplates(draft.baseUrl, billingTemplate),
    [billingTemplate, draft.baseUrl],
  );
  const billingSetupGuide = useMemo(
    () => buildBillingCurlSetupGuide({
      displayName: account.displayName,
      provider: account.provider,
      baseUrl: draft.baseUrl,
    }),
    [account.displayName, account.provider, draft.baseUrl],
  );
  const billingCurlVariableFields = useMemo(
    () => buildVendorCurlVariableFields({
      displayName: account.displayName,
      provider: account.provider,
      baseUrl: draft.baseUrl,
    }),
    [account.displayName, account.provider, draft.baseUrl],
  );
  const editorOpen = routedEditorOpen ?? localEditorOpen;
  const hasBillingScript = draft.billingCurl.trim().length > 0;
  const liveBalances = liveBilling?.isAvailable ? liveBilling.balances : [];

  function openEditor() {
    if (onOpenEditor) {
      onOpenEditor();
      return;
    }
    setLocalEditorOpen(true);
  }

  function closeEditor() {
    if (onCloseEditor) {
      onCloseEditor();
      return;
    }
    setLocalEditorOpen(false);
  }

  useEffect(() => {
    setTestStatus('idle');
    setTestMessage('');
    setTestBilling(undefined);
  }, [account.id]);

  async function runBillingTest() {
    if (!onTestBillingCurl || !draft.billingCurl.trim()) return;
    setTestStatus('loading');
    setTestMessage('');
    try {
      const result = await onTestBillingCurl({
        apiKey: draft.apiKey,
        baseUrl: draft.baseUrl,
        prefix: draft.prefix,
        billingCurl: draft.billingCurl.trim(),
        platformCookie: (draft.platformCookie ?? "").trim(),
        curlVariables: draft.curlVariables,
      });
      const nextBilling = normalizeBillingDisplay(result);
      setTestBilling(nextBilling);
      setTestStatus('success');
      if (!nextBilling) {
        setTestMessage('余额接口未返回余额数据');
      }
    } catch (error) {
      setTestMessage(toErrorMessage(error));
      setTestStatus('error');
    }
  }

  const billingActions = readOnlyScripts ? undefined : (
    <>
      {hasBillingScript ? (
        <button type="button" onClick={openEditor} className="btn-swiss !text-[length:var(--font-size-ui-2xs)]">
          编辑脚本
        </button>
      ) : null}
      <button
        type="button"
        onClick={runBillingTest}
        disabled={testStatus === 'loading' || !hasBillingScript || !onTestBillingCurl}
        className="btn-swiss !text-[length:var(--font-size-ui-2xs)]"
      >
        {testStatus === 'loading' ? '测试中...' : '测试余额'}
      </button>
      {!hasBillingScript ? (
        <button
          type="button"
          onClick={openEditor}
          className="btn-swiss !text-[length:var(--font-size-ui-2xs)]"
        >
          添加
        </button>
      ) : null}
    </>
  );

  return (
    <AccountDetailSection
      componentName="AccountBillingSection"
      eyebrow="Billing"
      title="余额"
      meta={liveBilling ? '实时余额已就绪' : undefined}
      actions={billingActions}
      topBorder={topBorder}
      headerDivider={headerDivider}
    >

      {liveBalances.length > 0 ? (
        <div className="grid gap-2 content-start">
          <div className="font-mono text-[length:var(--font-size-ui-2xs)] font-black uppercase tracking-[0.18em] text-[var(--text-muted)]">
            BALANCE
          </div>
          {liveBalances.map((balance, index) => (
            <div key={`${balance.currency}-${index}`} className="grid gap-2 border-y border-dashed border-[var(--border-color)] py-2 md:grid-cols-3">
              <RuntimeKV label="Total" value={`${balance.totalBalance} ${balance.currency}`.trim()} />
              <RuntimeKV label="Granted" value={`${balance.grantedBalance} ${balance.currency}`.trim()} />
              <RuntimeKV label="Topped Up" value={`${balance.toppedUpBalance} ${balance.currency}`.trim()} />
            </div>
          ))}
        </div>
      ) : (
        <AccountDetailEmptyState className="!border-0 !bg-transparent px-0 py-4 text-left !text-[length:var(--font-size-ui-xs)] !tracking-[0.08em]">
          {readOnlyScripts
            ? '暂无余额数据'
            : hasBillingScript ? '暂无余额数据，可测试余额脚本确认接口返回' : '暂无余额脚本，添加后可测试并展示余额'}
        </AccountDetailEmptyState>
      )}

      {hasBillingScript ? (
        <div className="grid gap-3 border-2 border-[var(--border-color)] bg-[var(--bg-surface)] p-3">
          <div className="truncate font-mono text-[length:var(--font-size-ui-xs)] text-[var(--text-muted)]" title={draft.billingCurl || undefined}>
            {draft.billingCurl || '未配置余额脚本'}
          </div>
        </div>
      ) : null}

      {testStatus === 'success' && testBilling ? (
        <div className="grid gap-2 content-start">
          <div className="font-mono text-[length:var(--font-size-ui-2xs)] font-black uppercase tracking-[0.18em] text-[var(--text-muted)]">
            BALANCE (TEST)
          </div>
          {testBilling.balances.map((balance, index) => (
            <div key={`${balance.currency}-${index}`} className="grid gap-2 border-y border-dashed border-[var(--border-color)] py-2 md:grid-cols-3">
              <RuntimeKV label="Total" value={`${balance.totalBalance} ${balance.currency}`.trim()} />
              <RuntimeKV label="Granted" value={`${balance.grantedBalance} ${balance.currency}`.trim()} />
              <RuntimeKV label="Topped Up" value={`${balance.toppedUpBalance} ${balance.currency}`.trim()} />
            </div>
          ))}
        </div>
      ) : null}
      {testStatus === 'success' && testMessage ? (
        <div className="text-[length:var(--font-size-ui-xs)] font-black uppercase text-[var(--text-muted)]">{testMessage}</div>
      ) : null}
      {testStatus === 'error' ? (
        <div className="text-[length:var(--font-size-ui-xs)] font-black uppercase text-[var(--color-status-danger)]">{testMessage}</div>
      ) : null}

      {editorOpen ? (
        <AccountCurlEditorModal
          title="余额脚本"
          value={draft.billingCurl}
          enabled={draft.billingEnabled}
          variables={buildCurlVariables(draft, billingCurlVariableFields)}
          templates={billingTemplates}
          placeholder={billingTemplate || 'curl -sS "{{baseUrl}}/billing" -H "Authorization: Bearer {{apiKey}}"'}
          setupGuide={billingSetupGuide}
          onValueChange={(value) => setDraft((prev) => ({ ...prev, billingCurl: value }))}
          onEnabledChange={(enabled) => setDraft((prev) => ({ ...prev, billingEnabled: enabled }))}
          onApplyTemplate={(template) => setDraft((prev) => ({ ...prev, billingCurl: template, billingEnabled: true }))}
          onClose={closeEditor}
        />
      ) : null}
    </AccountDetailSection>
  );
}

function RuntimeKV({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <div className="font-mono text-[length:var(--font-size-ui-2xs)] font-black uppercase tracking-[0.14em] text-[var(--text-muted)]">
        {label}
      </div>
      <div className="mt-1 truncate font-mono text-[length:var(--font-size-ui-xs)] font-black uppercase tracking-[0.04em] text-[var(--text-primary)]">
        {value}
      </div>
    </div>
  );
}

export function AccountDetailFooter({
  isApiKey,
  configDirty,
  rateLimitDirty = false,
  missingFields,
  savingConfig,
  onClose,
  onSaveConfig,
}: AccountDetailFooterProps) {
  const { t } = useI18n();
  const hasDirtyChanges = configDirty || rateLimitDirty;
  const dirtyMessage = configDirty && rateLimitDirty
    ? '账号配置 / 路由守卫有未保存改动'
    : configDirty
      ? '账号配置有未保存改动'
      : rateLimitDirty
        ? t('accounts.rate_limit_dirty')
        : '';

  return (
    <>
      <div
        data-account-detail-footer-status="single-line"
        className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-[length:var(--font-size-ui-xs)] font-black uppercase tracking-[0.08em] text-[var(--text-muted)]"
      >
        {isApiKey && missingFields.length > 0
          ? `缺少：${missingFields.join(', ')}`
          : dirtyMessage}
      </div>
      <div className="flex items-center gap-2">
        <button onClick={onClose} className="btn-swiss text-[length:var(--font-size-ui-xs)]">
          {t('common.close')}
        </button>
        {isApiKey || rateLimitDirty ? (
          <button
            onClick={onSaveConfig}
            disabled={!hasDirtyChanges || missingFields.length > 0 || savingConfig}
            className="btn-swiss bg-[var(--text-primary)] !text-[var(--bg-main)] !text-[length:var(--font-size-ui-xs)]"
          >
            {savingConfig ? '保存中...' : '保存改动'}
          </button>
        ) : null}
      </div>
    </>
  );
}

function normalizeBillingDisplay(result: any): BillingDisplay | undefined {
  if (!result?.isAvailable || !Array.isArray(result.balanceInfos) || result.balanceInfos.length === 0) {
    return undefined;
  }
  return {
    isAvailable: true,
    balances: result.balanceInfos.map((info: any) => ({
      currency: info?.currency ?? '',
      totalBalance: info?.totalBalance ?? '0',
      grantedBalance: info?.grantedBalance ?? '0',
      toppedUpBalance: info?.toppedUpBalance ?? '0',
    })),
  };
}
