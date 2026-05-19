import { Plus, Trash2, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toErrorMessage } from '../../../utils/error';
import { ModelCombobox } from './ModelCombobox';
import { buildEndpointLabel, sourceKindLabel } from './codexAccountPresentation';
import {
  buildCodexModelAliasOptionNames,
  buildCodexModelOptionNames,
  type CodexAccountRow,
  type CodexModelMappingRow,
} from '../model/codexAccountList';

export function CodexAccountDetailModal({
  row,
  t,
  savingMappings,
  loadingModelMappings,
  modelMappingError,
  modelOptions,
  codexModelOptions,
  loadingModelOptions,
  modelOptionError,
  onClose,
  onSaveModelMappings,
}: {
  row: CodexAccountRow;
  t: (key: string) => string;
  savingMappings: boolean;
  loadingModelMappings: boolean;
  modelMappingError: string;
  modelOptions: CodexModelMappingRow[];
  codexModelOptions: CodexModelMappingRow[];
  loadingModelOptions: boolean;
  modelOptionError: string;
  onClose: () => void;
  onSaveModelMappings: (mappings: CodexModelMappingRow[]) => Promise<void>;
}) {
  const endpointLabel = buildEndpointLabel(row);
  const blockedLabel = row.blockReason === 'disabled' ? t('codex.account_list_block_disabled') : row.blockReason;
  const [mappingDraft, setMappingDraft] = useState<CodexModelMappingRow[]>(() => buildEditableModelMappings(row));
  const [mappingError, setMappingError] = useState('');
  const editableModelMappings = row.sourceKind === 'openai-compatible' || row.sourceKind === 'codex-auth-file';
  const showModelMappings = editableModelMappings;
  const displayedModelMappings = editableModelMappings ? mappingDraft : row.modelMappings;
  const modelOptionNames = buildCodexModelOptionNames(modelOptions);
  const codexModelOptionNames = buildCodexModelAliasOptionNames([
    ...codexModelOptions,
    ...modelOptions,
    ...mappingDraft,
  ]);
  const modelSectionTitle = t('codex.account_list_model_mapping');
  const detailFields: Array<[string, string]> = [
    [t('common.type'), sourceKindLabel(t, row.sourceKind)],
    [t('common.status'), row.status || '—'],
    [t('codex.account_list_route'), endpointLabel || '—'],
    [t('codex.account_list_priority'), row.priority === undefined ? '—' : String(row.priority)],
    [
      t('codex.account_list_request_state'),
      row.requestable ? t('codex.account_list_state_requestable') : t('codex.account_list_state_blocked'),
    ],
    [t('common.enable'), row.disabled ? t('common.no') : t('common.yes')],
  ];

  useEffect(() => {
    setMappingDraft(buildEditableModelMappings(row));
    setMappingError('');
  }, [row.id, row.modelMappings]);

  function updateMappingDraft(index: number, patch: Partial<CodexModelMappingRow>) {
    setMappingDraft((prev) => prev.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item)));
  }

  function addMappingDraft() {
    setMappingDraft((prev) => [...prev, { realModel: '', codexModel: '' }]);
  }

  function removeMappingDraft(index: number) {
    setMappingDraft((prev) => {
      const next = prev.filter((_, itemIndex) => itemIndex !== index);
      return next.length > 0 || row.sourceKind === 'codex-auth-file' ? next : [{ realModel: '', codexModel: '' }];
    });
  }

  async function saveMappingDraft() {
    try {
      setMappingError('');
      await onSaveModelMappings(mappingDraft);
    } catch (error) {
      setMappingError(toErrorMessage(error));
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-[var(--overlay-scrim-80)] p-3 backdrop-blur-sm sm:p-6"
      data-collaboration-id="MODAL_CODEX_ACCOUNT_DETAIL"
      onClick={onClose}
    >
      <div
        className="flex max-h-[calc(100vh-1.5rem)] w-full max-w-4xl flex-col overflow-hidden border-2 border-[var(--border-color)] bg-[var(--bg-main)] shadow-hard shadow-[var(--shadow-color)] sm:max-h-[calc(100vh-3rem)]"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="flex shrink-0 items-start justify-between gap-4 border-b-2 border-[var(--border-color)] px-6 py-5">
          <div className="min-w-0 space-y-2">
            <div className="text-[length:var(--font-size-ui-xs)] font-black uppercase tracking-[0.2em] text-[var(--text-muted)]">
              {t('codex.account_list_detail_title')}
            </div>
            <h3 className="truncate text-lg font-black uppercase italic tracking-tighter text-[var(--text-primary)]">
              {row.label}
            </h3>
            <div className="flex flex-wrap gap-2">
              <span className="border border-[var(--border-color)] px-2 py-1 text-[length:var(--font-size-ui-2xs)] font-black uppercase tracking-[0.16em] text-[var(--text-muted)]">
                {sourceKindLabel(t, row.sourceKind)}
              </span>
              <span
                className={`border px-2 py-1 text-[length:var(--font-size-ui-2xs)] font-black uppercase tracking-[0.16em] ${
                  row.requestable
                    ? 'border-[var(--color-status-success)] bg-[color-mix(in_srgb,var(--color-status-success)_10%,transparent)] text-[var(--color-status-success)]'
                    : 'border-[var(--accent-red)] bg-[color-mix(in_srgb,var(--color-status-danger)_10%,transparent)] text-[var(--accent-red)]'
                }`}
              >
                {row.requestable ? t('codex.account_list_state_requestable') : t('codex.account_list_state_blocked')}
              </span>
            </div>
          </div>
          <button type="button" onClick={onClose} className="btn-swiss !p-1 !shadow-none hover:bg-[var(--bg-surface)]" aria-label={t('common.close')}>
            <X className="h-4 w-4" strokeWidth={4} />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-auto p-6">
          <section className="grid gap-4 border-b-2 border-dashed border-[var(--border-color)] pb-6 md:grid-cols-3">
            {detailFields.map(([label, value]) => (
              <div key={label} className="min-w-0 space-y-1">
                <div className="text-[length:var(--font-size-ui-xs)] font-black uppercase italic text-[var(--text-muted)]">{label}</div>
                <div className="break-all text-[length:var(--font-size-ui-md-compact)] font-black uppercase text-[var(--text-primary)]">{value}</div>
              </div>
            ))}
          </section>

          {!row.requestable ? (
            <section className="mt-6 border-2 border-[var(--accent-red)] bg-[color-mix(in_srgb,var(--color-status-danger)_10%,transparent)] px-4 py-3 text-[length:var(--font-size-ui-sm)] font-black uppercase tracking-wide text-[var(--accent-red)]">
              {blockedLabel}
            </section>
          ) : null}

          <section className="mt-6 space-y-3">
            <div className="flex items-center justify-between gap-4">
              <h4 className="text-[length:var(--font-size-ui-md)] font-black uppercase italic tracking-tighter text-[var(--text-primary)]">
                {modelSectionTitle}
              </h4>
              {showModelMappings ? (
                <span className="text-[length:var(--font-size-ui-2xs)] font-black uppercase tracking-[0.16em] text-[var(--text-muted)]">
                  {displayedModelMappings.length}
                </span>
              ) : null}
            </div>

            {showModelMappings ? (
              loadingModelMappings ? (
                <div className="border-2 border-dashed border-[var(--border-color)] px-4 py-6 text-center text-[length:var(--font-size-ui-sm)] font-black uppercase tracking-widest text-[var(--text-muted)]">
                  {t('accounts.ui_loading_short')}
                </div>
              ) : displayedModelMappings.length > 0 ? (
                <div className="border-2 border-[var(--border-color)]">
                  <div className="grid grid-cols-[minmax(0,1fr)_2.5rem_minmax(0,1fr)_2.25rem] border-b-2 border-[var(--border-color)] bg-[var(--bg-surface)] px-3 py-2 text-[length:var(--font-size-ui-2xs)] font-black uppercase tracking-[0.18em] text-[var(--text-muted)]">
                    <span>{t('codex.account_list_real_model')}</span>
                    <span className="text-center">-&gt;</span>
                    <span className="text-right">{t('codex.account_list_codex_model')}</span>
                    <span />
                  </div>
                  <div className="divide-y divide-[var(--border-color)]">
                    {displayedModelMappings.map((mapping, index) => (
                      <div
                        key={`mapping-${index}`}
                        className="grid min-h-[2.75rem] grid-cols-[minmax(0,1fr)_2.5rem_minmax(0,1fr)_2.25rem] items-center gap-2 px-3 py-2 text-[length:var(--font-size-ui-sm)] font-bold text-[var(--text-primary)]"
                      >
                        {editableModelMappings ? (
                          <ModelCombobox
                            value={mapping.realModel}
                            options={modelOptionNames}
                            onChange={(value) => updateMappingDraft(index, { realModel: value })}
                            placeholder={modelOptionNames[0] || 'deepseek-chat'}
                          />
                        ) : (
                          <span className="min-w-0 break-all font-mono text-[length:var(--font-size-ui-md-compact)] font-black text-[var(--text-primary)]">
                            {mapping.realModel}
                          </span>
                        )}
                        <span className="text-center font-black text-[var(--text-muted)]">-&gt;</span>
                        {editableModelMappings ? (
                          <ModelCombobox
                            value={mapping.codexModel}
                            options={codexModelOptionNames}
                            onChange={(value) => updateMappingDraft(index, { codexModel: value })}
                            placeholder={codexModelOptionNames[0] || mapping.realModel || 'codex-deepseek'}
                            align="right"
                          />
                        ) : (
                          <span className="min-w-0 break-all text-right font-mono text-[length:var(--font-size-ui-md-compact)] font-black text-[var(--text-primary)]">
                            {mapping.codexModel}
                          </span>
                        )}
                        {editableModelMappings ? (
                          <button
                            type="button"
                            onClick={() => removeMappingDraft(index)}
                            className="btn-swiss !p-1.5 !shadow-none hover:bg-[var(--bg-surface)]"
                            aria-label={t('common.delete')}
                          >
                            <Trash2 className="h-3.5 w-3.5" strokeWidth={3} />
                          </button>
                        ) : (
                          <span />
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="border-2 border-dashed border-[var(--border-color)] px-4 py-6 text-center text-[length:var(--font-size-ui-sm)] font-black uppercase tracking-widest text-[var(--text-muted)]">
                  {row.sourceKind === 'codex-auth-file'
                    ? t('codex.account_list_oauth_passthrough_mapping')
                    : editableModelMappings
                      ? t('codex.account_list_no_model_mapping')
                      : t('codex.account_list_default_model_mapping')}
                </div>
              )
            ) : (
              <div className="border-2 border-dashed border-[var(--border-color)] px-4 py-6 text-center text-[length:var(--font-size-ui-sm)] font-black uppercase tracking-widest text-[var(--text-muted)]">
                {t('codex.account_list_default_model_mapping')}
              </div>
            )}

            {modelMappingError ? (
              <div className="border-l-2 border-[var(--accent-red)] pl-3 text-[length:var(--font-size-ui-sm)] font-black uppercase tracking-wide text-[var(--accent-red)]">
                {modelMappingError}
              </div>
            ) : null}

            {editableModelMappings && (loadingModelOptions || modelOptionError) ? (
              <div
                className={`border-l-2 pl-3 text-[length:var(--font-size-ui-xs)] font-black uppercase tracking-wide ${
                  modelOptionError
                    ? 'border-[var(--accent-red)] text-[var(--accent-red)]'
                    : 'border-[var(--border-color)] text-[var(--text-muted)]'
                }`}
              >
                {modelOptionError || t('accounts.openai_provider_models_fetch_running')}
              </div>
            ) : null}

            {editableModelMappings ? (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={addMappingDraft}
                  className="btn-swiss inline-flex items-center gap-2 !py-1.5 !text-[length:var(--font-size-ui-xs)]"
                >
                  <Plus className="h-3.5 w-3.5" strokeWidth={4} />
                  {t('accounts.openai_provider_add_model')}
                </button>
                <button
                  type="button"
                  onClick={() => void saveMappingDraft()}
                  disabled={savingMappings}
                  className="btn-swiss bg-[var(--text-primary)] !py-1.5 !text-[length:var(--font-size-ui-xs)] !text-[var(--bg-main)] disabled:cursor-wait disabled:opacity-50"
                >
                  {savingMappings ? t('codex.account_list_saving') : t('common.save')}
                </button>
                {mappingError ? (
                  <div className="basis-full border-l-2 border-[var(--accent-red)] pl-3 text-[length:var(--font-size-ui-sm)] font-black uppercase tracking-wide text-[var(--accent-red)]">
                    {mappingError}
                  </div>
                ) : null}
              </div>
            ) : null}
          </section>
        </div>
      </div>
    </div>
  );
}

function buildEditableModelMappings(row: Pick<CodexAccountRow, 'sourceKind' | 'modelMappings'>): CodexModelMappingRow[] {
  if (row.sourceKind !== 'openai-compatible' && row.sourceKind !== 'codex-auth-file') {
    return [];
  }
  if (row.sourceKind === 'codex-auth-file' && row.modelMappings.length === 0) {
    return [];
  }
  return row.modelMappings.length > 0
    ? row.modelMappings.map((mapping) => ({ ...mapping }))
    : [{ realModel: '', codexModel: '' }];
}
