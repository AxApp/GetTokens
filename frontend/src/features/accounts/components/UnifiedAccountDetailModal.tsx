import { useEffect, useMemo, useRef, useState } from 'react';
import { useDebug } from '../../../context/useDebug';
import { useI18n } from '../../../context/I18nContext';
import type { AccountRecord } from '../../../types';
import { toErrorMessage } from '../../../utils/error';
import type { AccountUsageSummary } from '../model/accountUsage';
import {
  buildApiKeyConfigDraft,
  hasApiKeyConfigChanges,
  listApiKeyConfigMissingFields,
  type ApiKeyConfigDraft,
} from '../model/accountDetailConfig';
import { buildAccountDetailModulePlan } from '../model/accountDetailLayout';
import { normalizeAPIKeyModelNames } from '../model/apiKeyModelCatalog';
import { extractBilling, hasDisplayableBilling } from '../model/accountQuota';
import {
  buildAccountDetailStatusMessage,
  buildAccountRecentRouteDecisionSummaries,
} from '../model/accountPresentation';
import type { RateLimitState, RateLimitStrategyMeta } from '../model/rateLimit';
import type { CodexQuotaState } from '../model/types';
import ModalFrame from '../../../components/ui/ModalFrame';
import { AccountDetailLayout } from './AccountDetailLayout';
import {
  AccountBillingSection,
  AccountCredentialVerifySection,
  AccountDetailFooter,
  AccountDetailHeader,
  AccountQuotaSection,
  AccountRuntimeRouteSection,
  type APIKeyVerifyState,
  type AccountDetailLocalCliAction,
} from './AccountDetailSections';
import { AccountDetailNotice, AccountDetailEmptyState } from './AccountDetailPrimitives';
import RateLimitRulesSection, { type RateLimitRulesAPI, type RateLimitRulesSectionHandle } from './RateLimitRulesSection';
import { OAuthModelProbeSection, type OAuthModelProbeState } from './OAuthModelProbeSection';
import { AuthFileSummarySection } from './AccountDetailAuthFileSection';
import { CompatibleModelsSection } from './AccountDetailModelsSection';
import type { ChannelRouteDecisionSnapshot } from '../../channel-routing/model/channelRouting';

export type { APIKeyVerifyState } from './AccountDetailSections';

const SECTION_TITLES: Record<string, string> = {
  runtime: '运行态路由',
  credentials: '凭据验证',
  'auth-file-actions': '配置管理',
  models: '模型映射',
  'model-probe': '模型探测',
  'rate-limit': '限速规则',
  quota: '额度追踪',
  billing: '余额管理',
};

export interface UnifiedAccountDetailProps {
  account: AccountRecord;
  quotaState?: CodexQuotaState;
  usageSummary?: AccountUsageSummary;
  rateLimitStatus?: RateLimitState;
  rateLimitStrategies?: RateLimitStrategyMeta[];
  rateLimitRulesAPI?: RateLimitRulesAPI;
  verifyState?: APIKeyVerifyState;
  modelNames?: string[];
  localModelNames?: string[];
  cachedModelNames?: string[];
  routeDecisions?: ChannelRouteDecisionSnapshot[];
  oauthModelProbeState?: OAuthModelProbeState;
  activeScriptEditor?: 'quota' | 'billing' | null;
  onClose: () => void;
  onRename?: (nextName: string) => void;
  onStartReauth?: () => void;
  onCancelReauth?: () => void;
  isReauthing?: boolean;
  onSaveConfig?: (draft: ApiKeyConfigDraft) => Promise<void>;
  onVerify?: (params: { apiKey: string; baseUrl: string; model: string }) => void;
  onOAuthModelProbe?: (model: string) => void;
  onFetchModels?: (params: { apiKey: string; baseUrl: string; headers?: Record<string, string> }) => Promise<{ models: string[]; message: string }>;
  onOpenScriptEditor?: (type: 'quota' | 'billing') => void;
  onCloseScriptEditor?: () => void;
  onTestQuotaCurl?: (input: { apiKey: string; baseUrl: string; prefix: string; quotaCurl: string; platformCookie?: string; curlVariables?: Record<string, string> }) => Promise<unknown>;
  onTestBillingCurl?: (input: { apiKey: string; baseUrl: string; prefix: string; billingCurl: string; platformCookie?: string; curlVariables?: Record<string, string> }) => Promise<unknown>;
  onRateLimitRulesChanged?: () => void;
  localCliActions?: ReadonlyArray<AccountDetailLocalCliAction>;
}

export default function UnifiedAccountDetailModal(props: UnifiedAccountDetailProps) {
  const { account, quotaState } = props;
  const { t } = useI18n();
  const { trackRequest } = useDebug();
  const rateLimitRulesRef = useRef<RateLimitRulesSectionHandle | null>(null);

  const isApiKey = account.credentialSource === 'api-key';
  const [configDraft, setConfigDraft] = useState<ApiKeyConfigDraft>(() => buildApiKeyConfigDraft(account));
  const [configDirty, setConfigDirty] = useState(false);
  const [rateLimitDirty, setRateLimitDirty] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [savingConfig, setSavingConfig] = useState(false);
  const [proxyRouteError, setProxyRouteError] = useState('');

  useEffect(() => {
    setConfigDraft(buildApiKeyConfigDraft(account));
  }, [account.id, account.apiKey, account.baseUrl, account.formatBaseUrls, account.prefix, account.quotaCurl, account.quotaEnabled, account.billingCurl, account.billingEnabled, account.proxyUrl, account.models, isApiKey]);

  useEffect(() => { setRateLimitDirty(false); setSaveError(''); }, [account.id]);
  useEffect(() => { setSaveError(''); }, [configDraft]);

  const missingFields = useMemo(() => {
    if (!isApiKey) return [];
    const fields = listApiKeyConfigMissingFields(configDraft);
    if (proxyRouteError) fields.push(proxyRouteError);
    return fields;
  }, [configDraft, isApiKey, proxyRouteError]);

  const liveBilling = useMemo(() => (quotaState?.quota ? extractBilling(quotaState.quota) : undefined), [quotaState]);
  const statusMessage = useMemo(() => buildAccountDetailStatusMessage(account, t), [account, t]);
  const runtimeRouteDecisions = useMemo(() => buildAccountRecentRouteDecisionSummaries(account, props.routeDecisions ?? []), [account, props.routeDecisions]);
  const saveErrorMessage = useMemo(() => saveError ? { tone: 'danger' as const, title: '保存失败', body: saveError } : null, [saveError]);

  async function saveConfig() {
    if (savingConfig || missingFields.length > 0) return;
    setSaveError('');
    setSavingConfig(true);
    try {
      if (isApiKey && configDirty && props.onSaveConfig) {
        await props.onSaveConfig(configDraft);
      }
      if (rateLimitDirty) {
        const saved = await rateLimitRulesRef.current?.save();
        if (saved === false) return;
      }
      props.onClose();
    } catch (error) {
      setSaveError(toErrorMessage(error));
    } finally {
      setSavingConfig(false);
    }
  }

  const modulePlan = buildAccountDetailModulePlan(account);
  const sectionNavItems = modulePlan.map((id) => ({ id, title: SECTION_TITLES[id] ?? id }));

  function renderActiveSection(moduleID: string) {
    switch (moduleID) {
      case 'runtime':
        return <AccountRuntimeRouteSection account={account} routeDecisions={runtimeRouteDecisions} />;
      case 'credentials':
        return (
          <AccountCredentialVerifySection
            draft={configDraft}
            setDraft={setConfigDraft}
            verifyState={props.verifyState}
            modelNames={props.modelNames}
            span="wide"
            onVerify={props.onVerify}
            onProxyValidityChange={setProxyRouteError}
          />
        );
      case 'auth-file-actions':
        return <AuthFileSummarySection account={account} />;
      case 'models':
        return (
          <CompatibleModelsSection
            account={account}
            draft={configDraft}
            setDraft={setConfigDraft}
            modelNames={props.modelNames}
            localModelNames={props.localModelNames}
            cachedModelNames={props.cachedModelNames}
            editable={isApiKey && Boolean(props.onSaveConfig)}
            onFetchModels={props.onFetchModels}
          />
        );
      case 'model-probe': {
        const canProbeOAuthAccount = account.credentialSource === 'auth-file' && account.id.startsWith('acct_');
        const modelOptions = normalizeAPIKeyModelNames([
          ...(props.modelNames ?? []),
          ...(props.localModelNames ?? []),
          ...(account.models ?? []).map((model) => model.name),
        ]);
        return (
          <OAuthModelProbeSection
            accountID={account.id}
            accountLabel={account.displayName}
            modelOptions={modelOptions}
            defaultModel={modelOptions[0] || 'gpt-5.4-mini'}
            disabled={!canProbeOAuthAccount || !props.onOAuthModelProbe}
            disabledReason={canProbeOAuthAccount ? '当前运行环境不可执行模型测试' : '仅支持统一账号库 acct_ OAuth 账号模型测试'}
            probeState={props.oauthModelProbeState}
            onProbe={props.onOAuthModelProbe}
          />
        );
      }
      case 'rate-limit':
        return (
          <RateLimitRulesSection
            ref={rateLimitRulesRef}
            accountKey={account.id}
            rateLimitStatus={props.rateLimitStatus}
            rateLimitStrategies={props.rateLimitStrategies}
            rateLimitRulesAPI={props.rateLimitRulesAPI}
            t={t}
            onRateLimitRulesChanged={() => {
              setRateLimitDirty(true);
              props.onRateLimitRulesChanged?.();
            }}
          />
        );
      case 'quota': {
        const hasBillingModule = hasDisplayableBilling(liveBilling) || configDraft.billingEnabled;
        const showQuotaModule = configDraft.quotaEnabled || props.activeScriptEditor === 'quota';
        const showBillingModule = hasBillingModule || props.activeScriptEditor === 'billing';
        return (
          <div className="space-y-6">
            {showQuotaModule && (
              <AccountQuotaSection
                account={account}
                draft={configDraft}
                setDraft={setConfigDraft}
                quotaState={quotaState}
                editorOpen={props.activeScriptEditor === 'quota'}
                onOpenEditor={() => props.onOpenScriptEditor?.('quota')}
                onCloseEditor={props.onCloseScriptEditor}
                onTestQuotaCurl={props.onTestQuotaCurl}
                readOnlyScripts={account.credentialSource === 'auth-file'}
              />
            )}
            {showBillingModule && (
              <AccountBillingSection
                account={account}
                draft={configDraft}
                setDraft={setConfigDraft}
                liveBilling={liveBilling}
                editorOpen={props.activeScriptEditor === 'billing'}
                onOpenEditor={() => props.onOpenScriptEditor?.('billing')}
                onCloseEditor={props.onCloseScriptEditor}
                onTestBillingCurl={props.onTestBillingCurl}
              />
            )}
            {!showQuotaModule && !showBillingModule && (
              <AccountDetailEmptyState>请选择额度模块或余额模块</AccountDetailEmptyState>
            )}
          </div>
        );
      }
      case 'billing':
        return null;
      default:
        return null;
    }
  }

  const error = saveErrorMessage ? (
    <AccountDetailNotice tone="danger" className="mx-6 mb-2 shrink-0">
      <div className="font-semibold">{saveErrorMessage.title}</div>
      <div className="mt-1 text-xs">{saveErrorMessage.body}</div>
    </AccountDetailNotice>
  ) : statusMessage ? (
    <AccountDetailNotice tone={statusMessage.tone} className="mx-6 mb-2 shrink-0">
      <div className="font-semibold">{statusMessage.title}</div>
      <div className="mt-1 text-xs">{statusMessage.body}</div>
    </AccountDetailNotice>
  ) : undefined;

  return (
    <ModalFrame
      onClose={props.onClose}
      size="detail"
      panelAttributes={{ 'data-account-detail-modal': 'unified' }}
      headerClassName="hidden"
      error={error}
      footer={
        <AccountDetailFooter
          isApiKey={isApiKey}
          configDirty={configDirty}
          rateLimitDirty={rateLimitDirty}
          missingFields={missingFields}
          savingConfig={savingConfig}
          localCliActions={props.localCliActions}
          onSaveConfig={saveConfig}
        />
      }
    >
      <AccountDetailLayout
        sectionNavItems={sectionNavItems}
        header={<AccountDetailHeader {...props} />}
        onClose={props.onClose}
      >
        {modulePlan.map((moduleID) => (
          <div key={moduleID} data-account-detail-section={moduleID}>
            {renderActiveSection(moduleID)}
          </div>
        ))}
      </AccountDetailLayout>
    </ModalFrame>
  );
}
