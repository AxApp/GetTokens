import { RefreshCw, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState, type Dispatch, type SetStateAction } from 'react';
import { Button, Tooltip } from 'antd';
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
  AccountDetailSection,
} from './AccountDetailPrimitives';
import { getAccountsPreviewAuthFileModels } from '../previewData';

const modelMappingGridClass =
  'overflow-hidden rounded-md border border-[var(--gt-border-subtle)] bg-[var(--gt-surface-canvas)]';
const modelEditableCardClass =
  'grid min-h-[2.75rem] grid-cols-[minmax(0,1fr)_2rem_minmax(0,1fr)_2.5rem] items-center gap-2 border-b border-[var(--gt-border-subtle)] px-3 py-2 last:border-b-0';
const modelReadonlyCardClass =
  'grid min-h-[2.75rem] grid-cols-[minmax(0,1fr)_2rem_minmax(0,1fr)] items-center gap-2 border-b border-[var(--gt-border-subtle)] px-3 py-2 last:border-b-0';
const modelArrowClass =
  'shrink-0 text-center text-[length:var(--gt-font-size-sm)] text-[var(--gt-ink-muted)]';
const modelValueClass =
  'min-w-0 truncate font-mono text-[length:var(--gt-font-size-sm)] font-normal text-[var(--gt-ink-primary)]';
const modelRouteValueClass =
  'min-w-0 truncate font-mono text-[length:var(--gt-font-size-sm)] font-normal text-[var(--gt-ink-muted)]';
const fetchStatusClass =
  'rounded-md border border-[var(--gt-border-default)] bg-[var(--gt-surface-muted)] px-3 py-2 text-[length:var(--gt-font-size-xs)] font-normal text-[var(--gt-ink-muted)]';
const fetchErrorClass =
  'rounded-md border border-[color-mix(in_srgb,var(--gt-status-danger)_28%,transparent)] bg-[color-mix(in_srgb,var(--gt-status-danger)_8%,white)] px-3 py-2 text-[length:var(--gt-font-size-xs)] font-normal text-[var(--gt-status-danger)]';

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
  onAuthFileModelNamesChange,
}: {
  account: AccountRecord;
  draft: ApiKeyConfigDraft;
  setDraft: Dispatch<SetStateAction<ApiKeyConfigDraft>>;
  modelNames?: string[];
  localModelNames?: string[];
  cachedModelNames?: string[];
  editable: boolean;
  onFetchModels?: (input: { apiKey: string; baseUrl: string; headers?: Record<string, string> }) => Promise<{ models: string[]; message: string }>;
  onAuthFileModelNamesChange?: (modelNames: string[]) => void;
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
    if (!isAuthFile || !account.name) {
      onAuthFileModelNamesChange?.([]);
      return;
    }
    let cancelled = false;
    onAuthFileModelNamesChange?.([]);
    setLoading(true);
    void (async () => {
      try {
        if (!hasWailsAppBindings()) {
          const previewModels = getAccountsPreviewAuthFileModels(account.name!);
          if (cancelled) return;
          setModels(previewModels);
          onAuthFileModelNamesChange?.(normalizeAuthFileModelNames(previewModels));
          setLoading(false);
          return;
        }
        const result = await trackRequest('GetAuthFileModels', { name: account.name }, () => GetAuthFileModels(account.name!));
        if (cancelled) return;
        const nextModels = (result as any)?.models ?? [];
        setModels(nextModels);
        onAuthFileModelNamesChange?.(normalizeAuthFileModelNames(nextModels));
      } catch {
        // Model catalog is optional detail metadata.
      }
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [account.name, isAuthFile, onAuthFileModelNamesChange, trackRequest]);

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
          <Tooltip title="拉取模型">
            <Button
              type="text"
              size="small"
              icon={<RefreshCw />}
              onClick={() => void fetchRemoteModelMappings()}
              disabled={remoteModelStatus === 'loading' || !onFetchModels}
              aria-label="拉取模型"
            />
          </Tooltip>
          <Button size="small" onClick={applyDefaultModelMappings}>
            填入支持模型
          </Button>
          <Button size="small" onClick={onAddModelMapping}>
            添加映射
          </Button>
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
        <div className="h-4 w-1/3 bg-[var(--gt-border-strong)]" />
      ) : displayedModels.length === 0 ? (
        <AccountDetailEmptyState>
          {editable ? '暂无模型映射；可拉取模型后添加映射，或直接手动添加。' : '暂无模型数据'}
        </AccountDetailEmptyState>
      ) : (
        <div data-account-model-mapping-grid="source-route" className={modelMappingGridClass}>
          {displayedModels.map((model, index) => {
            const modelName = String(model.name ?? model.id ?? model.display_name ?? `MODEL ${index + 1}`);
            const routeLabel = String(model.alias ?? (isAuthFile ? 'oauth available' : modelName));
            return (
              <div
                key={index}
                data-account-model-mapping-card={editable ? 'editable' : 'readonly'}
                className={editable ? modelEditableCardClass : modelReadonlyCardClass}
              >
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
                    <div data-account-model-mapping-route-status className={modelRouteValueClass}>{routeLabel}</div>
                  )}
                </div>
                {editable ? (
                  <Tooltip title="删除映射">
                    <Button
                      type="text"
                      size="small"
                      icon={<Trash2 />}
                      onClick={() => removeModelMapping(index)}
                      aria-label="删除映射"
                    />
                  </Tooltip>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </AccountDetailSection>
  );
}

function normalizeAuthFileModelNames(models: any[]): string[] {
  return normalizeAPIKeyModelNames((models || []).map((model) => String(model?.id || model?.name || model?.display_name || '').trim()));
}
