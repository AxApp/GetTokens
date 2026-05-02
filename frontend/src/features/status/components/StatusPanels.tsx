import { useEffect, useMemo, useRef, useState } from 'react';
import type { main } from '../../../../wailsjs/go/models';
import type { RelayResolvedModelOption } from '../model/relayModelCatalog';
import { filterRelayModelCatalogByQuery, sortRelayModelCatalogByNameDesc } from '../model/relayModelCatalog';
import type { RelayProviderOption } from '../model/relayProviderCatalog';

interface StatusServiceConfigSectionProps {
  t: (key: string) => string;
  relayKeyItems: main.RelayServiceAPIKeyItem[];
  relayKeysLength: number;
  selectedKeyIndex: number;
  openKeyMenuIndex: number | null;
  serviceMessage: string;
  isSavingServiceKeys: boolean;
  isReady: boolean;
  onOpenCreateRelayKeyEditor: () => void;
  onSelectKeyIndex: (index: number) => void;
  onToggleKeyMenuIndex: (index: number) => void;
  onOpenRenameRelayKeyEditor: (index: number) => void;
  onDeleteRelayServiceAPIKey: (index: number) => void;
  relayKeyDisplayName: (value: string, index: number) => string;
  maskRelayKey: (value: string) => string;
  formatRelayKeyTimestamp: (value?: string) => string;
}

export function StatusServiceConfigSection({
  t,
  relayKeyItems,
  relayKeysLength,
  selectedKeyIndex,
  openKeyMenuIndex,
  serviceMessage,
  isSavingServiceKeys,
  isReady,
  onOpenCreateRelayKeyEditor,
  onSelectKeyIndex,
  onToggleKeyMenuIndex,
  onOpenRenameRelayKeyEditor,
  onDeleteRelayServiceAPIKey,
  relayKeyDisplayName,
  maskRelayKey,
  formatRelayKeyTimestamp,
}: StatusServiceConfigSectionProps) {
  return (
    <section className="relative overflow-visible border-2 border-[var(--border-color)] bg-[var(--bg-surface)]">
      <div className="flex items-center justify-between gap-3 border-b-2 border-[var(--border-color)] bg-[var(--bg-main)] px-5 py-3">
        <div>
          <div className="text-[0.625rem] font-black italic uppercase tracking-widest text-[var(--text-primary)]">
            {t('status.service_config')}
          </div>
          <div className="mt-1 text-[0.625rem] font-black uppercase tracking-wide text-[var(--text-muted)]">
            {relayKeysLength} {t('status.service_api_keys')}
          </div>
        </div>
        <button
          onClick={onOpenCreateRelayKeyEditor}
          disabled={isSavingServiceKeys || !isReady}
          className="btn-swiss !px-3 !py-1 !text-[0.625rem] disabled:cursor-not-allowed disabled:opacity-50"
        >
          +
        </button>
      </div>
      <div className="space-y-4 p-5">
        <div className="overflow-hidden border-2 border-[var(--border-color)]">
          {relayKeyItems.map((item, index) => (
            <div
              key={`${item.value}-${index}`}
              className={`flex items-center gap-3 px-4 py-3 ${
                index > 0 ? 'border-t-2 border-[var(--border-color)]' : ''
              } ${selectedKeyIndex === index ? 'bg-[var(--bg-main)]' : 'bg-[var(--bg-surface)]'}`}
            >
              <button onClick={() => onSelectKeyIndex(index)} className="min-w-0 flex-1 text-left">
                <div className="text-[0.625rem] font-black uppercase tracking-widest text-[var(--text-primary)]">
                  {relayKeyDisplayName(item.value, index)}
                </div>
                <div className="mt-1 font-mono text-[0.625rem] font-black uppercase tracking-wide text-[var(--text-primary)]">
                  {maskRelayKey(item.value)}
                </div>
                <div className="mt-2 grid gap-1 text-[0.5625rem] font-bold uppercase tracking-wide text-[var(--text-muted)] md:grid-cols-2">
                  <div>
                    {t('status.service_key_created_at')}: {formatRelayKeyTimestamp(item.createdAt)}
                  </div>
                  <div>
                    {t('status.service_key_last_used_at')}: {formatRelayKeyTimestamp(item.lastUsedAt)}
                  </div>
                </div>
              </button>
              <div className="relative shrink-0" onClick={(event) => event.stopPropagation()}>
                <button
                  onClick={() => onToggleKeyMenuIndex(index)}
                  className="flex h-7 w-7 items-center justify-center text-base font-black text-[var(--text-muted)]"
                >
                  ⋮
                </button>
                {openKeyMenuIndex === index ? (
                  <div className="absolute right-full top-1/2 z-10 mr-2 flex -translate-y-1/2 items-center gap-2">
                    <button
                      onClick={() => onOpenRenameRelayKeyEditor(index)}
                      className="btn-swiss whitespace-nowrap !px-3 !py-1 !text-[0.5625rem]"
                    >
                      {t('status.service_key_rename')}
                    </button>
                    <button
                      onClick={() => onDeleteRelayServiceAPIKey(index)}
                      className="btn-swiss whitespace-nowrap !px-3 !py-1 !text-[0.5625rem]"
                    >
                      {t('status.service_key_delete')}
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
          ))}
        </div>
        <div className="text-[0.625rem] font-black uppercase tracking-wide text-[var(--text-muted)]">
          {t('status.service_keys_hint')}
        </div>
        {serviceMessage ? (
          <div className="border-2 border-dashed border-[var(--border-color)] bg-[var(--bg-main)] px-4 py-3 text-[0.625rem] font-black uppercase tracking-wide text-[var(--text-primary)]">
            {serviceMessage}
          </div>
        ) : null}
      </div>
    </section>
  );
}

interface StatusApplyLocalSectionProps {
  t: (key: string) => string;
  localApplyMessage: string;
  isLANAccessEnabled: boolean;
  isApplyingToLocal: boolean;
  isReady: boolean;
  visibleRelayEndpoints: main.RelayServiceEndpoint[];
  selectedEndpointID: string;
  selectedEndpointBaseUrl: string;
  relayProviderOptions: RelayProviderOption[];
  selectedRelayProviderID: string;
  relayReasoningEffortOptions: string[];
  selectedRelayReasoningEffort: string;
  selectedRelayModel: string;
  relayModelDraft: string;
  resolvedRelayModels: RelayResolvedModelOption[];
  onToggleLANAccess: () => void;
  onApplyRelayConfigToLocal: () => void;
  onSelectEndpointID: (id: string) => void;
  onCopyEndpointBaseUrl: () => void;
  onOpenCreateRelayProviderEditor: () => void;
  onSelectRelayProviderID: (id: string) => void;
  onDeleteRelayProviderOption: (id: string) => void;
  onSelectRelayReasoningEffort: (value: string) => void;
  onChangeRelayModelDraft: (value: string) => void;
  onCommitRelayModelSelection: (value: string) => void;
}

export function StatusApplyLocalSection({
  t,
  localApplyMessage,
  isLANAccessEnabled,
  isApplyingToLocal,
  isReady,
  visibleRelayEndpoints,
  selectedEndpointID,
  selectedEndpointBaseUrl,
  relayProviderOptions,
  selectedRelayProviderID,
  relayReasoningEffortOptions,
  selectedRelayReasoningEffort,
  selectedRelayModel,
  relayModelDraft,
  resolvedRelayModels,
  onToggleLANAccess,
  onApplyRelayConfigToLocal,
  onSelectEndpointID,
  onCopyEndpointBaseUrl,
  onOpenCreateRelayProviderEditor,
  onSelectRelayProviderID,
  onDeleteRelayProviderOption,
  onSelectRelayReasoningEffort,
  onChangeRelayModelDraft,
  onCommitRelayModelSelection,
}: StatusApplyLocalSectionProps) {
  const [isRelayModelMenuOpen, setIsRelayModelMenuOpen] = useState(false);
  const relayModelMenuRef = useRef<HTMLDivElement | null>(null);
  const sortedRelayModels = useMemo(
    () => sortRelayModelCatalogByNameDesc(resolvedRelayModels),
    [resolvedRelayModels]
  );
  const filteredRelayModels = useMemo(
    () => filterRelayModelCatalogByQuery(sortedRelayModels, relayModelDraft),
    [relayModelDraft, sortedRelayModels]
  );

  useEffect(() => {
    if (!isRelayModelMenuOpen) {
      return;
    }

    function handlePointerDown(event: MouseEvent) {
      if (!relayModelMenuRef.current?.contains(event.target as Node)) {
        setIsRelayModelMenuOpen(false);
      }
    }

    document.addEventListener('mousedown', handlePointerDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
    };
  }, [isRelayModelMenuOpen]);

  function commitRelayModelSelection(value: string) {
    onCommitRelayModelSelection(value);
    setIsRelayModelMenuOpen(false);
  }

  return (
    <section className="relative overflow-visible border-2 border-[var(--border-color)] bg-[var(--bg-surface)]">
      <div className="flex items-center justify-between gap-3 border-b-2 border-[var(--border-color)] bg-[var(--bg-main)] px-4 py-3">
        <div>
          <div className="text-[0.625rem] font-black italic uppercase tracking-widest text-[var(--text-primary)]">
            {t('status.apply_local')}
          </div>
          {localApplyMessage ? (
            <div className="mt-1 text-[0.625rem] font-black uppercase tracking-wide text-[var(--text-muted)]">
              {localApplyMessage}
            </div>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onToggleLANAccess}
            className={`btn-swiss !px-2.5 !py-1.5 !text-[0.625rem] ${
              isLANAccessEnabled ? 'bg-[var(--text-primary)] !text-[var(--bg-main)]' : ''
            }`}
          >
            {isLANAccessEnabled ? t('status.lan_access_on') : t('status.lan_access_off')}
          </button>
          <button
            onClick={onApplyRelayConfigToLocal}
            disabled={isApplyingToLocal || !isReady}
            className="btn-swiss bg-[var(--border-color)] !px-3 !py-1.5 !text-[0.625rem] !text-[var(--bg-main)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isApplyingToLocal ? t('status.applying_local') : t('status.apply_local')}
          </button>
        </div>
      </div>
      <div className="space-y-2 p-3">
        <div className="grid gap-2">
          <div className="grid gap-2 lg:grid-cols-[6.5rem_minmax(0,1fr)] lg:items-start">
            <div className="pt-1 text-[0.5625rem] font-black uppercase tracking-[0.18em] text-[var(--text-primary)]">
              {t('status.endpoint_title')}
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap gap-2">
                {visibleRelayEndpoints.map((endpoint) => {
                  const isSelected = selectedEndpointID === endpoint.id;
                  const endpointLabel =
                    endpoint.kind === 'localhost'
                      ? t('status.endpoint_localhost')
                      : endpoint.kind === 'hostname'
                        ? t('status.endpoint_hostname')
                        : t('status.endpoint_lan');

                  return (
                    <button
                      key={endpoint.id}
                      onClick={() => onSelectEndpointID(endpoint.id)}
                      className={`border-2 px-2.5 py-1.5 text-[0.5625rem] font-black uppercase tracking-[0.18em] ${
                        isSelected
                          ? 'border-[var(--border-color)] bg-[var(--text-primary)] text-[var(--bg-main)]'
                          : 'border-[var(--border-color)] bg-[var(--bg-surface)] text-[var(--text-primary)]'
                      }`}
                    >
                      {endpointLabel}
                    </button>
                  );
                })}
              </div>
              <div className="mt-2 flex items-center gap-2 border border-dashed border-[var(--border-color)] bg-[var(--bg-surface)] px-2.5 py-1.5">
                <div className="min-w-0 flex-1 break-all font-mono text-[0.6875rem] font-bold text-[var(--text-primary)]">
                  {selectedEndpointBaseUrl}
                </div>
                <button
                  onClick={onCopyEndpointBaseUrl}
                  className="shrink-0 text-[0.5625rem] font-black uppercase tracking-[0.18em] text-[var(--text-muted)]"
                >
                  复制
                </button>
              </div>
            </div>
          </div>

          <div className="grid gap-2 lg:grid-cols-[6.5rem_minmax(0,1fr)] lg:items-start">
            <div className="pt-1">
              <div className="text-[0.5625rem] font-black uppercase tracking-[0.18em] text-[var(--text-primary)]">
                {t('status.provider_title')}
              </div>
            </div>
            <div className="max-h-24 overflow-auto pr-1">
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={onOpenCreateRelayProviderEditor}
                  className="border-2 border-[var(--border-color)] bg-[var(--bg-surface)] px-2.5 py-1.5 text-[0.625rem] font-black uppercase tracking-wide text-[var(--text-primary)]"
                >
                  +
                </button>
                {relayProviderOptions.map((provider) => {
                  const isSelected = selectedRelayProviderID === provider.id;
                  const label = provider.name === provider.id ? provider.id : `${provider.name} / ${provider.id}`;
                  return (
                    <div
                      key={provider.id}
                      className={`border-2 px-2.5 py-1.5 ${
                        isSelected
                          ? 'border-[var(--border-color)] bg-[var(--text-primary)] text-[var(--bg-main)]'
                          : 'border-[var(--border-color)] bg-[var(--bg-surface)] text-[var(--text-primary)]'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => onSelectRelayProviderID(provider.id)}
                          className="text-left text-[0.625rem] font-black uppercase tracking-wide"
                        >
                          {label}
                        </button>
                        <button
                          onClick={() => onDeleteRelayProviderOption(provider.id)}
                          className={isSelected ? 'text-[var(--bg-main)]' : 'text-[var(--text-muted)]'}
                        >
                          ×
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="grid gap-2 lg:grid-cols-[6.5rem_minmax(0,1fr)] lg:items-start">
            <div className="pt-1 text-[0.5625rem] font-black uppercase tracking-[0.18em] text-[var(--text-primary)]">
              {t('status.reasoning_effort_title')}
            </div>
            <div className="flex flex-wrap gap-2">
              {relayReasoningEffortOptions.map((effort) => (
                <button
                  key={effort}
                  onClick={() => onSelectRelayReasoningEffort(effort)}
                  className={`border-2 px-2.5 py-1.5 font-mono text-[0.625rem] font-black uppercase tracking-wide ${
                    selectedRelayReasoningEffort === effort
                      ? 'border-[var(--border-color)] bg-[var(--text-primary)] text-[var(--bg-main)]'
                      : 'border-[var(--border-color)] bg-[var(--bg-surface)] text-[var(--text-primary)]'
                  }`}
                >
                  {effort}
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-2 lg:grid-cols-[6.5rem_minmax(0,1fr)] lg:items-start">
            <div className="pt-1">
              <div className="text-[0.5625rem] font-black uppercase tracking-[0.18em] text-[var(--text-primary)]">
                {t('status.model_name_title')}
              </div>
            </div>
            <div className="grid gap-2 lg:grid-cols-[minmax(0,1fr)_14rem]">
              <input
                value={relayModelDraft}
                onChange={(event) => onChangeRelayModelDraft(event.target.value)}
                onFocus={() => setIsRelayModelMenuOpen(true)}
                onBlur={() => commitRelayModelSelection(relayModelDraft)}
                onKeyDown={(event) => {
                  if (event.key !== 'Enter') {
                    return;
                  }
                  event.preventDefault();
                  commitRelayModelSelection(relayModelDraft);
                }}
                className="input-swiss w-full"
                placeholder={t('status.model_name_placeholder')}
              />
              <div ref={relayModelMenuRef} className="relative">
                <button
                  type="button"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => setIsRelayModelMenuOpen((prev) => !prev)}
                  className="select-swiss flex items-center justify-between gap-3 text-left"
                  aria-haspopup="listbox"
                  aria-expanded={isRelayModelMenuOpen}
                >
                  <span className="truncate">{selectedRelayModel || t('status.model_name_title')}</span>
                  <span className="shrink-0 text-[0.625rem] font-black uppercase tracking-[0.2em] text-[var(--text-primary)]">
                    ▼
                  </span>
                </button>
                {isRelayModelMenuOpen ? (
                  <div
                    className="absolute left-0 right-0 top-[calc(100%+0.5rem)] z-20 max-h-72 overflow-auto border-2 border-[var(--border-color)] bg-[var(--bg-main)] p-2 shadow-[6px_6px_0_var(--shadow-color)]"
                    role="listbox"
                  >
                    <div className="space-y-2">
                      {filteredRelayModels.length > 0 ? (
                        filteredRelayModels.map((model) => {
                          const isSelected = selectedRelayModel === model.name;
                          return (
                            <button
                              key={model.name}
                              type="button"
                              onMouseDown={(event) => event.preventDefault()}
                              onClick={() => commitRelayModelSelection(model.name)}
                              className={`flex w-full items-center justify-between gap-3 border-2 px-3 py-2 text-left text-[0.625rem] font-black uppercase tracking-[0.12em] transition-transform ${
                                isSelected
                                  ? 'border-[var(--text-primary)] bg-[var(--bg-surface)] text-[var(--text-primary)]'
                                  : 'border-[var(--border-color)] bg-[var(--bg-main)] text-[var(--text-muted)] hover:translate-x-[-1px] hover:translate-y-[-1px]'
                              }`}
                              role="option"
                              aria-selected={isSelected}
                            >
                              <span className="truncate">{model.name}</span>
                              {isSelected ? <span className="text-[0.5rem] tracking-[0.18em]">ACTIVE</span> : null}
                            </button>
                          );
                        })
                      ) : (
                        <div className="border-2 border-dashed border-[var(--border-color)] bg-[var(--bg-surface)] px-3 py-4 text-center text-[0.5625rem] font-black uppercase tracking-[0.18em] text-[var(--text-muted)]">
                          {t('status.model_name_placeholder')}
                        </div>
                      )}
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

interface StatusSnippetPanelProps {
  title: string;
  content: string;
  onCopy: () => void;
}

export function StatusSnippetPanel({ title, content, onCopy }: StatusSnippetPanelProps) {
  return (
    <div className="overflow-hidden border-2 border-[var(--border-color)]">
      <div className="flex items-center justify-between border-b-2 border-[var(--border-color)] bg-[var(--bg-main)] px-4 py-2">
        <div className="font-mono text-[0.625rem] font-black uppercase tracking-widest text-[var(--text-primary)]">
          {title}
        </div>
        <button onClick={onCopy} className="btn-swiss !px-3 !py-1 !text-[0.5625rem]">
          复制
        </button>
      </div>
      <pre className="overflow-x-auto bg-[var(--bg-surface)] p-4 text-xs font-bold leading-6 text-[var(--text-primary)]">
        {content}
      </pre>
    </div>
  );
}
