import { RefreshCw, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState, type Dispatch, type SetStateAction } from 'react';
import { GetAuthFileModels } from '../../../../wailsjs/go/main/App';
import { useDebug } from '../../../context/useDebug';
import type { AccountRecord } from '../../../types';
import { toErrorMessage } from '../../../utils/error';
import { hasWailsAppBindings } from '../../../utils/previewMode';
import { Combobox } from '../../../components/ui/Combobox.tsx';
import {
  resolveManagementBaseUrl,
  type ApiKeyConfigDraft,
} from '../model/accountDetailConfig';
import { normalizeAPIKeyModelNames } from '../model/apiKeyModelCatalog';
import { getVendorPreset } from '../model/vendorPresets';
import { resolveVendorPresetID } from '../model/vendorPresetHelpers';
import {
  AccountDetailEmptyState,
  AccountDetailPill,
  AccountDetailSection,
} from './AccountDetailPrimitives';
import { getAccountsPreviewAuthFileModels } from '../previewData';

const iconButtonClass =
  'inline-flex h-8 w-8 items-center justify-center rounded-md border border-[var(--gt-border-default)] bg-[var(--gt-surface-panel)] text-[var(--gt-ink-muted)] transition hover:bg-[var(--gt-surface-muted)] hover:text-[var(--gt-ink-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gt-focus-ring)] focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50';
const buttonClass =
  'inline-flex h-9 items-center justify-center gap-1.5 rounded-md border border-[var(--gt-border-default)] bg-[var(--gt-surface-panel)] px-3 text-xs font-medium text-[var(--gt-ink-primary)] transition hover:bg-[var(--gt-surface-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gt-focus-ring)] focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50';
const modelCardClass =
  'flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-[var(--gt-surface-muted)] transition-colors';
const modelArrowClass =
  'text-sm text-[var(--gt-ink-muted)] shrink-0';
const modelValueClass =
  'truncate text-sm text-[var(--gt-ink-primary)]';
const fetchStatusClass =
  'rounded-md border border-[var(--gt-border-default)] bg-[var(--gt-surface-panel)] px-3 py-2 text-xs font-medium text-[var(--gt-ink-muted)]';
const fetchErrorClass =
  'rounded-md border border-[color-mix(in_srgb,var(--gt-status-danger)_28%,transparent)] bg-[color-mix(in_srgb,var(--gt-status-danger)_8%,white)] px-3 py-2 text-xs font-medium text-[var(--gt-status-danger)]';

function setConfigDraftModels(
  setDraft: Dispatch<SetStateAction<ApiKeyConfigDraft>>,
  nextModels: Array<{ name: string; alias?: string }>,
) {
  setDraft((prev) => ({ ...prev, models: nextModels }));
}

function resolveDefaultModelMappingNames(
  account: AccountRecord,
  draft: ApiKeyConfigDraft,
) {
  const accountModelNames = (account.models ?? []).map((model) => model.name);
  const presetID = resolveVendorPresetID(draft.label || account.displayName || account.provider, draft.baseUrl);
  const presetModelNames = presetID ? getVendorPreset(presetID)?.modelSuggestions ?? [] : [];
  return normalizeAPIKeyModelNames([...accountModelNames, ...presetModelNames]);
}

export function CompatibleModelsSection({
  account,
  draft,
  setDraft,
  modelNames = [],
  localModelNames = [],
  cachedModelNames = [],
  editable,
  onFetchModels,
}: {
  account: AccountRecord;
  draft: ApiKeyConfigDraft;
  setDraft: Dispatch<SetStateAction<ApiKeyConfigDraft>>;
  modelNames?: string[];
  localModelNames?: string[];
  cachedModelNames?: string[];
  editable: boolean;
  onFetchModels?: (input: { apiKey: string; baseUrl: string; headers?: Record<string, string> }) => Promise<{ models: string[]; message: string }>;
}) {
  const { trackRequest } = useDebug();
  const [models, setModels] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [remoteModelStatus, setRemoteModelStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [remoteModelMessage, setRemoteModelMessage] = useState('');
  const isAuthFile = account.credentialSource === 'auth-file';
  const defaultModelNames = useMemo(
    () => resolveDefaultModelMappingNames(account, draft),
    [account, draft.baseUrl, draft.label],
  );
  const sourceModelOptionNames = useMemo(
    () => normalizeAPIKeyModelNames([
      ...cachedModelNames,
      ...defaultModelNames,
      ...(account.models ?? []).map((model) => model.name),
      ...draft.models.map((model) => model.name),
    ]),
    [account.models, cachedModelNames, defaultModelNames, draft.models],
  );
  const aliasModelOptionNames = useMemo(
    () => normalizeAPIKeyModelNames(localModelNames),
    [localModelNames],
  );

  const staticModels = useMemo(() => {
    if (editable) return draft.models;
    const accountModels = account.models ?? [];
    if (accountModels.length > 0) return accountModels;
    return modelNames.map((name) => ({ name }));
  }, [account.models, draft.models, editable, modelNames]);

  const displayedModels = isAuthFile ? models : staticModels;

  useEffect(() => {
    if (!isAuthFile || !account.name) return;
    let cancelled = false;
    setLoading(true);
    void (async () => {
      try {
        if (!hasWailsAppBindings()) {
          const previewModels = getAccountsPreviewAuthFileModels(account.name!);
          if (cancelled) return;
          setModels(previewModels);
          setLoading(false);
          return;
        }
        const result = await trackRequest('GetAuthFileModels', { name: account.name }, () => GetAuthFileModels(account.name!));
        if (cancelled) return;
        setModels((result as any)?.models ?? []);
      } catch {
        // Model catalog is optional detail metadata.
      }
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [account.name, isAuthFile, trackRequest]);

  function onAddModelMapping() {
    const usedNames = new Set(draft.models.map((model) => String(model.name ?? '').trim()).filter(Boolean));
    const nextSourceName = sourceModelOptionNames.find((name) => !usedNames.has(name)) ?? sourceModelOptionNames[0] ?? '';
    const nextModels = [...draft.models, { name: nextSourceName, alias: '' }];
    setConfigDraftModels(setDraft, nextModels);
    setRemoteModelStatus('idle');
    setRemoteModelMessage(nextSourceName ? `已新增映射：${nextSourceName}` : '已新增空映射，可手动输入 source model');
  }

  function applyDefaultModelMappings() {
    if (sourceModelOptionNames.length === 0) {
      setRemoteModelStatus('error');
      setRemoteModelMessage('暂无当前账号支持模型，可先拉取模型或手动添加映射');
      return;
    }
    setConfigDraftModels(setDraft, sourceModelOptionNames.map((name) => ({ name, alias: '' })));
    setRemoteModelStatus('idle');
    setRemoteModelMessage(`已填入 ${sourceModelOptionNames.length} 个当前账号支持模型`);
  }

  async function fetchRemoteModelMappings() {
    if (!onFetchModels || !draft.apiKey.trim() || !draft.baseUrl.trim()) {
      setRemoteModelStatus('error');
      setRemoteModelMessage('缺少 API 密钥或基础 URL，无法拉取模型');
      return;
    }
    setRemoteModelStatus('loading');
    setRemoteModelMessage('');
    try {
      const result = await onFetchModels({
        apiKey: draft.apiKey.trim(),
        baseUrl: resolveManagementBaseUrl({ baseUrl: draft.baseUrl, formatBaseUrls: draft.formatBaseUrls }),
        headers: account.headers || {},
      });
      const nextNames = normalizeAPIKeyModelNames(result.models);
      setRemoteModelStatus('success');
      setRemoteModelMessage(result.message || `已缓存 ${nextNames.length} 个当前账号支持模型`);
    } catch (error) {
      setRemoteModelStatus('error');
      setRemoteModelMessage(toErrorMessage(error));
    }
  }

  function updateModelMapping(index: number, patch: { name?: string; alias?: string }) {
    const nextModels = draft.models.map((model, modelIndex) => (
      modelIndex === index ? { ...model, ...patch } : model
    ));
    setConfigDraftModels(setDraft, nextModels);
  }

  function removeModelMapping(index: number) {
    const nextModels = draft.models.filter((_, modelIndex) => modelIndex !== index);
    setConfigDraftModels(setDraft, nextModels);
  }

  return (
    <AccountDetailSection
      componentName="CompatibleModelsSection"
      eyebrow="Model Mapping"
      title="模型映射"
      meta={displayedModels.length > 0 ? `${displayedModels.length} 个模型` : undefined}
      bandActionDivider={false}
      actions={editable ? (
        <>
          <button
            type="button"
            onClick={() => void fetchRemoteModelMappings()}
            disabled={remoteModelStatus === 'loading' || !onFetchModels}
            className={iconButtonClass}
            aria-label="拉取模型"
            title="拉取模型"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${remoteModelStatus === 'loading' ? 'animate-spin' : ''}`} strokeWidth={2} />
          </button>
          <button type="button" onClick={applyDefaultModelMappings} className={buttonClass}>
            填入支持模型
          </button>
          <button type="button" onClick={onAddModelMapping} className={buttonClass}>
            添加映射
          </button>
        </>
      ) : undefined}
    >
      {editable && remoteModelMessage ? (
        <div
          data-account-model-fetch-status={remoteModelStatus}
          className={remoteModelStatus === 'error' ? fetchErrorClass : fetchStatusClass}
        >
          {remoteModelMessage}
        </div>
      ) : null}
      {loading ? (
        <div className="h-4 w-1/3 animate-pulse bg-[var(--gt-border-strong)]" />
      ) : displayedModels.length === 0 ? (
        <AccountDetailEmptyState>
          {editable ? '暂无模型映射；可拉取模型后添加映射，或直接手动添加。' : '暂无模型数据'}
        </AccountDetailEmptyState>
      ) : (
        <div data-account-model-mapping-grid="source-route" className="grid gap-1.5 sm:grid-cols-2">
          {displayedModels.map((model, index) => {
            const modelName = String(model.name ?? model.id ?? model.display_name ?? `MODEL ${index + 1}`);
            const routeLabel = String(model.alias ?? (isAuthFile ? 'oauth available' : modelName));
            return (
              <div key={index} data-account-model-mapping-card={editable ? 'editable' : 'readonly'} className={modelCardClass}>
                <div className="min-w-0">
                  {editable ? (
                    <div data-account-model-mapping-input="source">
                      <Combobox
                        value={modelName}
                        options={sourceModelOptionNames}
                        placeholder={sourceModelOptionNames[0] || modelName || '选择 Source Model'}
                        maxOptions={12}
                        onChange={(value) => updateModelMapping(index, { name: value })}
                      />
                    </div>
                  ) : (
                    <div className={modelValueClass}>{modelName}</div>
                  )}
                </div>
                <div className={modelArrowClass}>→</div>
                <div className="min-w-0">
                  {editable ? (
                    <div data-account-model-mapping-input="alias">
                      <Combobox
                        value={String(model.alias ?? '')}
                        options={aliasModelOptionNames}
                        placeholder={aliasModelOptionNames[0] || modelName || '选择 Alias Model'}
                        maxOptions={12}
                        onChange={(value) => updateModelMapping(index, { alias: value })}
                      />
                    </div>
                  ) : (
                    <div className={modelValueClass}>{routeLabel}</div>
                  )}
                </div>
                {editable ? (
                  <button
                    type="button"
                    onClick={() => removeModelMapping(index)}
                    className={iconButtonClass}
                    aria-label="删除映射"
                    title="删除映射"
                  >
                    <Trash2 className="h-3.5 w-3.5" strokeWidth={2} />
                  </button>
                ) : (
                  <AccountDetailPill className="!min-h-0 !py-0.5 text-[10px]">只读</AccountDetailPill>
                )}
              </div>
            );
          })}
        </div>
      )}
    </AccountDetailSection>
  );
}
