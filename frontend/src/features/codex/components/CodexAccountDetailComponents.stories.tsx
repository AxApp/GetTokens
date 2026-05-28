import { useMemo, useState, type ReactNode } from 'react';
import { ArrowRight, BadgeCheck, CircleDollarSign, Route, WalletCards } from 'lucide-react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { useI18n } from '../../../context/I18nContext';
import type { BillingDisplay } from '../../../types';
import DesignSystemStoryFrame from '../../design-system/DesignSystemStoryFrame';
import AccountDetailModalFrame from '../../accounts/components/AccountDetailModalFrame';
import {
  AccountBillingSection,
  AccountCredentialVerifySection,
  AccountQuotaSection,
  type APIKeyVerifyState,
} from '../../accounts/components/AccountDetailSections';
import AccountProxyRouteSection from '../../accounts/components/AccountProxyRouteSection';
import {
  AccountDetailBody,
  AccountDetailEmptyState,
  AccountDetailModuleStack,
  AccountDetailSection,
} from '../../accounts/components/AccountDetailPrimitives';
import type { CodexQuotaState } from '../../accounts/model/types';
import {
  buildApiKeyConfigDraft,
  type ApiKeyConfigDraft,
} from '../../accounts/model/accountDetailConfig';
import { buildQuotaDisplay } from '../../accounts/model/accountQuota';
import {
  buildCodexModelAliasOptionNames,
  buildCodexModelOptionNames,
  buildCodexQuotaSummaryAccount,
  canEditCodexModelMappings,
  type CodexAccountRow,
  type CodexModelMappingRow,
} from '../model/codexAccountList';
import { CodexAccountDetailHeader } from './CodexAccountDetailModal';
import { ModelCombobox } from './ModelCombobox';
import { getCodexAccountListPreviewRows } from '../previewData';
import { getAccountsPreviewUsageByID } from '../../accounts/previewData';

const meta = {
  title: 'Design System/业务组件/Codex 账号详情',
  parameters: {
    layout: 'fullscreen',
  },
} satisfies Meta;

export default meta;
type Story = StoryObj;

function ModalViewport({ children }: { children: ReactNode }) {
  return (
    <DesignSystemStoryFrame label="DS-CODEX-DETAIL-DESKTOP-DRAFT">
      <div className="relative h-[45rem] w-[76rem] min-w-[76rem] overflow-hidden border-2 border-[var(--border-color)] bg-[var(--bg-surface)] [transform:translateZ(0)]">
        {children}
      </div>
    </DesignSystemStoryFrame>
  );
}

const previewRows = getCodexAccountListPreviewRows();
const openAICompatibleRow = previewRows.find((row) => row.id === 'openai-compatible:deepseek')
  ?? previewRows.find((row) => row.sourceKind === 'openai-compatible')
  ?? previewRows[0];
const usageByID = getAccountsPreviewUsageByID(previewRows);

const deepseekQuotaState = {
  status: 'success',
  quota: {
    planType: 'PRO',
    windows: [
      { id: 'five-hour', label: '5H', remainingPercent: 64, resetLabel: '2026-05-28 18:40', resetAtUnix: 1748361600 },
      { id: 'weekly', label: '7D', remainingPercent: 82, resetLabel: '2026-06-01 08:00', resetAtUnix: 1748745600 },
    ],
  },
} as unknown as CodexQuotaState;

const deepseekBilling: BillingDisplay = {
  isAvailable: true,
  balances: [
    { currency: 'USD', totalBalance: '128.50', grantedBalance: '80.00', toppedUpBalance: '48.50' },
  ],
};

const verifyState: APIKeyVerifyState = {
  model: 'deepseek-chat',
  status: 'success',
  message: '连接正常，deepseek-chat 已就绪',
  lastVerifiedAt: Date.now() - 120000,
};

function CodexAccountDetailDesktopDraft() {
  const { t } = useI18n();
  const row = openAICompatibleRow;
  const account = useMemo(() => buildCodexQuotaSummaryAccount(row), [row]);
  const quotaDisplay = useMemo(() => buildQuotaDisplay(account, deepseekQuotaState), [account]);
  const usageSummary = usageByID[row.id];
  const [configDraft, setConfigDraft] = useState<ApiKeyConfigDraft>(() => buildApiKeyConfigDraft(account));
  const [mappingDraft, setMappingDraft] = useState<CodexModelMappingRow[]>(
    row.modelMappings.length > 0
      ? row.modelMappings.map((mapping) => ({ ...mapping }))
      : [{ realModel: 'deepseek-chat', codexModel: 'codex-deepseek' }],
  );
  const editableModelMappings = canEditCodexModelMappings(row.sourceKind);
  const modelOptionNames = buildCodexModelOptionNames(row.modelMappings);
  const codexModelOptionNames = buildCodexModelAliasOptionNames(row.modelMappings);

  return (
    <ModalViewport>
      <AccountDetailModalFrame
        onClose={() => undefined}
        header={<CodexAccountDetailHeader row={row} t={t} onClose={() => undefined} />}
        footer={
          <>
            <div className="min-w-0 text-[length:var(--font-size-ui-xs)] font-black uppercase tracking-[0.15em] text-[var(--text-muted)]">
              Desktop draft · OpenAI compatible
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="btn-swiss inline-flex items-center gap-2 bg-[var(--text-primary)] !text-[var(--bg-main)]"
              >
                {t('common.save')}
                <ArrowRight className="h-3.5 w-3.5" strokeWidth={3.2} />
              </button>
              <button type="button" className="btn-swiss">
                {t('common.cancel')}
              </button>
            </div>
          </>
        }
      >
        <AccountDetailBody
          data-collaboration-id="DS-CODEX-ACCOUNT-DETAIL-DESKTOP-DRAFT"
          className="!space-y-4 bg-[var(--bg-surface)]"
        >
          <CodexOperationalDeck
            routeLabel={configDraft.proxyUrl || 'direct'}
            quotaLabel={`${quotaDisplay.windows[0]?.remainingPercent ?? '--'}%`}
            balanceLabel={`$${deepseekBilling.balances[0]?.totalBalance ?? '0.00'}`}
            requestCount={usageSummary?.requestCount ?? 0}
          />

          <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1.28fr)_minmax(22rem,0.72fr)]">
            <AccountDetailModuleStack layout="cards" cardColumns={1} className="content-start">
              <AccountCredentialVerifySection
                draft={configDraft}
                setDraft={setConfigDraft}
                verifyState={verifyState}
                modelNames={['deepseek-chat', 'deepseek-reasoner']}
                onVerify={() => undefined}
              />
              <div className="grid min-w-0 gap-4 xl:grid-cols-2">
                <AccountQuotaSection
                  account={account}
                  draft={configDraft}
                  setDraft={setConfigDraft}
                  quotaState={deepseekQuotaState}
                  quotaDisplay={quotaDisplay}
                  onTestQuotaCurl={async () => ({ planType: 'PRO', windows: deepseekQuotaState.quota?.windows })}
                />
                <AccountBillingSection
                  account={account}
                  draft={configDraft}
                  setDraft={setConfigDraft}
                  liveBilling={deepseekBilling}
                  onTestBillingCurl={async () => ({
                    isAvailable: true,
                    balanceInfos: [
                      { currency: 'USD', totalBalance: '128.50', grantedBalance: '80.00', toppedUpBalance: '48.50' },
                    ],
                  })}
                />
              </div>
            </AccountDetailModuleStack>

            <AccountDetailModuleStack layout="cards" cardColumns={1} className="content-start">
              <AccountProxyRouteSection
                proxyUrl={configDraft.proxyUrl}
                onProxyUrlChange={(url) => setConfigDraft((prev) => ({ ...prev, proxyUrl: url }))}
                onValidityChange={() => undefined}
              />
              <CodexModelRoutingPreview
                t={t}
                row={row}
                mappings={mappingDraft}
                editable={editableModelMappings}
                modelOptionNames={modelOptionNames}
                codexModelOptionNames={codexModelOptionNames}
                onUpdate={(index, patch) =>
                  setMappingDraft((prev) => prev.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item)))
                }
                onAdd={() => setMappingDraft((prev) => [...prev, { realModel: '', codexModel: '' }])}
                onRemove={(index) => setMappingDraft((prev) => prev.filter((_, itemIndex) => itemIndex !== index))}
              />
              <AccountDetailSection
                componentName="DS-RateLimitInlineDraft"
                eyebrow="Rate Limit"
                title="限频规则"
                density="dense"
              >
                <AccountDetailEmptyState>预览模式 · 当前账号使用默认路由限频</AccountDetailEmptyState>
              </AccountDetailSection>
            </AccountDetailModuleStack>
          </div>
        </AccountDetailBody>
      </AccountDetailModalFrame>
    </ModalViewport>
  );
}

function CodexOperationalDeck({
  routeLabel,
  quotaLabel,
  balanceLabel,
  requestCount,
}: {
  routeLabel: string;
  quotaLabel: string;
  balanceLabel: string;
  requestCount: number;
}) {
  return (
    <AccountDetailSection
      componentName="DS-CodexOperationalDeck"
      eyebrow="Runtime"
      title="运行控制面板"
      density="dense"
      className="bg-[var(--bg-main)]"
    >
      <div className="grid min-w-0 grid-cols-4 gap-3">
        <OperationalMetric
          icon={<BadgeCheck className="h-4 w-4" strokeWidth={3} />}
          label="connection"
          value="verified"
          meta="deepseek-chat"
        />
        <OperationalMetric
          icon={<Route className="h-4 w-4" strokeWidth={3} />}
          label="route"
          value={routeLabel}
          meta="proxy override"
        />
        <OperationalMetric
          icon={<WalletCards className="h-4 w-4" strokeWidth={3} />}
          label="quota"
          value={quotaLabel}
          meta="5h window"
        />
        <OperationalMetric
          icon={<CircleDollarSign className="h-4 w-4" strokeWidth={3} />}
          label="balance"
          value={balanceLabel}
          meta={`${requestCount} preview requests`}
        />
      </div>
    </AccountDetailSection>
  );
}

function OperationalMetric({
  icon,
  label,
  value,
  meta,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  meta: string;
}) {
  return (
    <div className="grid min-h-[5.25rem] min-w-0 content-between border-2 border-[var(--border-color)] bg-[var(--bg-surface)] p-3">
      <div className="flex min-w-0 items-center justify-between gap-2">
        <span className="inline-flex h-7 w-7 items-center justify-center bg-[var(--text-primary)] text-[var(--bg-main)]">
          {icon}
        </span>
        <span className="font-mono text-[length:var(--font-size-ui-2xs)] font-black uppercase tracking-[0.18em] text-[var(--text-muted)]">
          {label}
        </span>
      </div>
      <div className="min-w-0">
        <div className="truncate font-mono text-[length:var(--font-size-ui-sm)] font-black uppercase text-[var(--text-primary)]">
          {value}
        </div>
        <div className="mt-1 truncate text-[length:var(--font-size-ui-2xs)] font-bold uppercase tracking-[0.12em] text-[var(--text-muted)]">
          {meta}
        </div>
      </div>
    </div>
  );
}

function CodexModelRoutingPreview({
  t,
  row,
  mappings,
  editable,
  modelOptionNames,
  codexModelOptionNames,
  onUpdate,
  onAdd,
  onRemove,
}: {
  t: (key: string) => string;
  row: CodexAccountRow;
  mappings: CodexModelMappingRow[];
  editable: boolean;
  modelOptionNames: string[];
  codexModelOptionNames: string[];
  onUpdate: (index: number, patch: Partial<CodexModelMappingRow>) => void;
  onAdd: () => void;
  onRemove: (index: number) => void;
}) {
  return (
    <AccountDetailSection
      componentName="DS-ModelRouting"
      eyebrow="Model Routing"
      title={t('codex.account_list_model_mapping')}
      meta={row.provider}
      density="dense"
      actions={
        editable ? (
          <button type="button" onClick={onAdd} className="btn-swiss inline-flex items-center gap-2 !py-1.5 !text-[length:var(--font-size-ui-xs)]">
            + {t('accounts.openai_provider_add_model')}
          </button>
        ) : undefined
      }
    >
      {mappings.length > 0 ? (
        <div className="border-2 border-[var(--border-color)]">
          <div className="grid grid-cols-[minmax(0,1fr)_2.5rem_minmax(0,1fr)_2.25rem] border-b-2 border-[var(--border-color)] bg-[var(--bg-surface)] px-3 py-2 text-[length:var(--font-size-ui-2xs)] font-black uppercase tracking-[0.18em] text-[var(--text-muted)]">
            <span>{t('codex.account_list_real_model')}</span>
            <span className="text-center">-&gt;</span>
            <span className="text-right">{t('codex.account_list_codex_model')}</span>
            <span />
          </div>
          <div className="divide-y divide-[var(--border-color)]">
            {mappings.map((mapping, index) => (
              <div
                key={`mapping-${index}`}
                className="grid min-h-[2.75rem] grid-cols-[minmax(0,1fr)_2.5rem_minmax(0,1fr)_2.25rem] items-center gap-2 px-3 py-2 text-[length:var(--font-size-ui-sm)] font-bold text-[var(--text-primary)]"
              >
                {editable ? (
                  <ModelCombobox
                    value={mapping.realModel}
                    options={modelOptionNames}
                    onChange={(value) => onUpdate(index, { realModel: value })}
                    placeholder={modelOptionNames[0] || 'deepseek-chat'}
                  />
                ) : (
                  <span className="min-w-0 break-all font-mono text-[length:var(--font-size-ui-md-compact)] font-black text-[var(--text-primary)]">
                    {mapping.realModel}
                  </span>
                )}
                <span className="text-center font-black text-[var(--text-muted)]">-&gt;</span>
                {editable ? (
                  <ModelCombobox
                    value={mapping.codexModel}
                    options={codexModelOptionNames}
                    onChange={(value) => onUpdate(index, { codexModel: value })}
                    placeholder={codexModelOptionNames[0] || mapping.realModel || 'codex-deepseek'}
                    align="right"
                  />
                ) : (
                  <span className="min-w-0 break-all text-right font-mono text-[length:var(--font-size-ui-md-compact)] font-black text-[var(--text-primary)]">
                    {mapping.codexModel}
                  </span>
                )}
                {editable ? (
                  <button
                    type="button"
                    onClick={() => onRemove(index)}
                    className="btn-swiss !p-1.5 !shadow-none hover:bg-[var(--bg-surface)]"
                    aria-label={t('common.delete')}
                  >
                    ✕
                  </button>
                ) : (
                  <span />
                )}
              </div>
            ))}
          </div>
        </div>
      ) : (
        <AccountDetailEmptyState>
          {t('codex.account_list_no_model_mapping')}
        </AccountDetailEmptyState>
      )}
    </AccountDetailSection>
  );
}

export const DesktopDraft: Story = { render: () => <CodexAccountDetailDesktopDraft /> };
