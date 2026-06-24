import { Plus, RefreshCw } from 'lucide-react';
import { Button, Tooltip } from 'antd';
import WorkspacePageHeader from '../../../components/ui/WorkspacePageHeader';
import type { AccountUsageSummary } from '../model/accountUsage';
import type { RateLimitState } from '../model/rateLimit';
import type { Translator } from '../model/types';
import type { OpenAICompatibleProvider, ProviderRemoteModelsState, ProviderVerifyState } from '../model/openAICompatible';
import { buildProviderConfigSignature } from '../model/openAICompatible';
import OpenAICompatibleProviderCard from './OpenAICompatibleProviderCard';

interface OpenAICompatibleWorkspaceProps {
  t: Translator;
  ready: boolean;
  loading: boolean;
  providers: OpenAICompatibleProvider[];
  verifyStates: Record<string, ProviderVerifyState>;
  remoteModelsStates: Record<string, ProviderRemoteModelsState>;
  pendingDeleteName: string | null;
  pendingStatusName: string | null;
  accountUsageByID?: Record<string, AccountUsageSummary>;
  accountRateLimitByID?: Record<string, RateLimitState>;
  onCreate: () => void;
  onRefresh: () => void;
  onOpenDetail: (provider: OpenAICompatibleProvider) => void;
  onDelete: (name: string) => void;
  onToggleDisabled: (provider: OpenAICompatibleProvider) => void;
  embedded?: boolean;
}

const openAICompatibleWorkspaceShellClass =
  'h-full w-full overflow-auto bg-[var(--gt-surface-canvas)] p-12';
const openAICompatibleWorkspaceContentClass =
  'mx-auto max-w-6xl space-y-8 pb-32';
const openAICompatibleWorkspaceEmbeddedClass =
  'space-y-8';
const openAICompatibleWorkspaceActionsClass =
  'flex flex-wrap items-center justify-end gap-2';
const openAICompatibleWorkspaceActionButtonClass =
  'inline-flex h-10 w-10 items-center justify-center rounded-md border border-[var(--gt-border-subtle)] bg-[var(--gt-surface-canvas)] text-[var(--gt-ink-muted)] transition hover:border-[var(--gt-ink-primary)] hover:bg-[var(--gt-surface-muted)] hover:text-[var(--gt-ink-primary)] disabled:cursor-not-allowed disabled:opacity-50';
const openAICompatibleWorkspacePrimaryButtonClass =
  'inline-flex h-10 items-center justify-center gap-2 rounded-md border border-[var(--gt-border-subtle)] bg-[var(--gt-ink-primary)] px-3 text-[length:var(--gt-font-size-xs)] font-normal text-[var(--gt-surface-canvas)] transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50';
const openAICompatibleWorkspaceStateClass =
  'rounded-md border border-[var(--gt-border-subtle)] bg-[var(--gt-surface-muted)] px-6 py-16 text-center';
const openAICompatibleWorkspaceStateTitleClass =
  'text-[length:var(--gt-font-size-md)] font-semibold tracking-normal text-[var(--gt-ink-primary)]';
const openAICompatibleWorkspaceStateHintClass =
  'mx-auto mt-2 max-w-2xl text-[length:var(--gt-font-size-sm)] font-normal tracking-normal text-[var(--gt-ink-muted)]';

export default function OpenAICompatibleWorkspace({
  t,
  ready,
  loading,
  providers,
  verifyStates,
  remoteModelsStates,
  pendingDeleteName,
  pendingStatusName,
  accountUsageByID = {},
  accountRateLimitByID = {},
  onCreate,
  onRefresh,
  onOpenDetail,
  onDelete,
  onToggleDisabled,
  embedded = false,
}: OpenAICompatibleWorkspaceProps) {
  const content = (
    <>
      <WorkspacePageHeader
        title={t('accounts.openai_provider_title')}
        subtitle={
          <>
            {t('accounts.openai_provider_subtitle')} / {providers.length} {t('accounts.ui_provider_count_unit')}
          </>
        }
        actions={
          <div data-openai-compatible-workspace-actions="quiet" className={openAICompatibleWorkspaceActionsClass}>
            <Tooltip title={t('common.refresh')}>
              <Button
                size="small"
                icon={<RefreshCw className="h-4 w-4" strokeWidth={2.5} />}
                onClick={onRefresh}
                className={openAICompatibleWorkspaceActionButtonClass}
                disabled={!ready || loading}
                aria-label={t('common.refresh')}
              />
            </Tooltip>
            <Button
              size="small"
              icon={<Plus className="h-4 w-4" strokeWidth={2.5} />}
              onClick={onCreate}
              className={openAICompatibleWorkspacePrimaryButtonClass}
              disabled={!ready}
            >
              {t('accounts.openai_provider_add')}
            </Button>
          </div>
        }
      />

      {!ready ? (
        <OpenAICompatibleWorkspaceState state="loading" title={t('common.loading')} />
      ) : loading ? (
        <OpenAICompatibleWorkspaceState state="loading" title={t('common.loading')} />
      ) : providers.length === 0 ? (
        <OpenAICompatibleWorkspaceState
          state="empty"
          title={t('accounts.openai_provider_empty')}
          hint={t('accounts.openai_provider_empty_hint')}
        />
      ) : (
        <div className="grid grid-cols-1 gap-8 md:grid-cols-2 xl:grid-cols-3">
          {providers.map((provider) => {
              const providerConfigSignature = buildProviderConfigSignature(provider);
              const cachedVerifyState = verifyStates[provider.name];
              const cachedRemoteModelsState = remoteModelsStates[provider.name];
              const verifyState =
                cachedVerifyState?.configSignature === providerConfigSignature
                  ? cachedVerifyState
                  : {
                      model: '',
                      status: 'idle' as const,
                      message: '',
                      lastVerifiedAt: null,
                    };
              const remoteModelsState =
                cachedRemoteModelsState?.configSignature === providerConfigSignature ? cachedRemoteModelsState : undefined;
              const effectiveModelCount =
                remoteModelsState?.status === 'success' ? remoteModelsState.models.length : provider.modelCount || 0;
              const providerID = openAICompatibleProviderIdentity(provider);

              return (
                <OpenAICompatibleProviderCard
                  key={providerID}
                  t={t}
                  provider={provider}
                  verifyState={verifyState}
                  effectiveModelCount={effectiveModelCount}
                  usageSummary={accountUsageByID[providerID]}
                  rateLimitStatus={accountRateLimitByID[providerID]}
                  pendingDelete={pendingDeleteName === providerID || pendingDeleteName === provider.name}
                  pendingStatus={pendingStatusName === providerID || pendingStatusName === provider.name}
                  onOpenDetail={onOpenDetail}
                  onDelete={onDelete}
                  onToggleDisabled={onToggleDisabled}
                />
              );
          })}
        </div>
      )}
    </>
  );

  if (embedded) {
    return (
      <section
        className={openAICompatibleWorkspaceEmbeddedClass}
        data-collaboration-id="PAGE_ACCOUNTS_OPENAI_COMPATIBLE_SECTION"
        data-openai-compatible-workspace="quiet"
      >
        {content}
      </section>
    );
  }

  return (
    <div
      className={openAICompatibleWorkspaceShellClass}
      data-collaboration-id="PAGE_ACCOUNTS_OPENAI_COMPATIBLE"
      data-openai-compatible-workspace="quiet"
    >
      <div className={openAICompatibleWorkspaceContentClass}>{content}</div>
    </div>
  );
}

function OpenAICompatibleWorkspaceState({
  state,
  title,
  hint,
}: {
  state: 'loading' | 'empty';
  title: string;
  hint?: string;
}) {
  return (
    <div data-openai-compatible-workspace-state={state} className={openAICompatibleWorkspaceStateClass}>
      <div className={openAICompatibleWorkspaceStateTitleClass}>{title}</div>
      {hint ? <p className={openAICompatibleWorkspaceStateHintClass}>{hint}</p> : null}
    </div>
  );
}

function openAICompatibleProviderIdentity(provider: OpenAICompatibleProvider): string {
  const accountKey = String(provider.accountKey || '').trim();
  if (accountKey) {
    return accountKey;
  }
  return String(provider.name || '').trim();
}
