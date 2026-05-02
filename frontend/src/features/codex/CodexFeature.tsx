import { useEffect, useMemo, useState } from 'react';
import WorkspacePageHeader from '../../components/ui/WorkspacePageHeader';
import { useDebug } from '../../context/DebugContext';
import { useI18n } from '../../context/I18nContext';
import type { CodexWorkspace } from '../../types';
import { toErrorMessage } from '../../utils/error';
import {
  getCodexFeatureConfig,
  previewCodexFeatureConfig,
  saveCodexFeatureConfig,
} from '../status/api/codexFeatures';
import { StatusCodexFeaturesSection } from '../status/components/StatusPanels';
import {
  buildCodexFeatureChangeInput,
  buildCodexFeatureDraft,
  selectCodexFeatureRows,
  setCodexFeatureDraftValue,
  type CodexFeatureChangeInput,
  type CodexFeatureConfigSnapshot,
  type CodexFeatureDraft,
  type CodexFeaturePreview,
  type CodexFeatureStageFilter,
} from '../status/model/codexFeatureConfig';

interface CodexFeatureProps {
  workspace: CodexWorkspace;
}

export default function CodexFeature({ workspace }: CodexFeatureProps) {
  const { t } = useI18n();
  const { trackRequest } = useDebug();
  const [snapshot, setSnapshot] = useState<CodexFeatureConfigSnapshot | null>(null);
  const [draft, setDraft] = useState<CodexFeatureDraft>({ values: {} });
  const [preview, setPreview] = useState<CodexFeaturePreview | null>(null);
  const [message, setMessage] = useState('');
  const [query, setQuery] = useState('');
  const [stageFilter, setStageFilter] = useState<CodexFeatureStageFilter>('all');
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const rows = useMemo(
    () =>
      snapshot
        ? selectCodexFeatureRows(snapshot, draft, {
            query,
            stageFilter,
          })
        : [],
    [draft, query, snapshot, stageFilter]
  );
  const dirtyCount = useMemo(
    () =>
      snapshot
        ? selectCodexFeatureRows(snapshot, draft, { stageFilter: 'all' }).filter((row) => row.dirty).length
        : 0,
    [draft, snapshot]
  );

  async function reload(messageOverride?: string) {
    setIsLoading(true);
    try {
      const nextSnapshot = await trackRequest('GetCodexFeatureConfig', { args: [] }, () =>
        getCodexFeatureConfig()
      );
      setSnapshot(nextSnapshot);
      setDraft(buildCodexFeatureDraft(nextSnapshot));
      setPreview(null);
      setMessage(messageOverride || t('status.codex_features_loaded'));
    } catch (error) {
      console.error(error);
      setMessage(`${t('status.codex_features_load_failed')}: ${toErrorMessage(error)}`);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    if (workspace !== 'feature-config') {
      return;
    }
    void reload();
  }, [workspace]);

  function resetDraft() {
    if (!snapshot) {
      return;
    }
    setDraft(buildCodexFeatureDraft(snapshot));
    setPreview(null);
    setMessage(t('status.codex_features_reset_done'));
  }

  function toggleFeature(key: string, value: boolean) {
    setDraft((prev) => setCodexFeatureDraftValue(prev, key, value));
    setPreview(null);
    setMessage('');
  }

  async function previewChanges(inputOverride?: CodexFeatureChangeInput) {
    if (!snapshot) {
      return null;
    }

    const input = inputOverride || buildCodexFeatureChangeInput(snapshot, draft);
    if (Object.keys(input.values).length === 0) {
      setPreview(null);
      setMessage(t('status.codex_features_no_changes'));
      return null;
    }

    try {
      const nextPreview = await trackRequest('PreviewCodexFeatureConfig', input, () =>
        previewCodexFeatureConfig(input, snapshot.configPath)
      );
      setPreview(nextPreview);
      setMessage(t('status.codex_features_preview_ready'));
      return { input, preview: nextPreview };
    } catch (error) {
      console.error(error);
      setMessage(`${t('status.codex_features_preview_failed')}: ${toErrorMessage(error)}`);
      return null;
    }
  }

  async function saveChanges() {
    if (!snapshot) {
      return;
    }

    setIsSaving(true);
    try {
      const input = buildCodexFeatureChangeInput(snapshot, draft);
      const previewResult = await previewChanges(input);
      if (!previewResult) {
        return;
      }

      await trackRequest('SaveCodexFeatureConfig', previewResult.input, () =>
        saveCodexFeatureConfig(previewResult.input)
      );
      await reload(t('status.codex_features_saved'));
    } catch (error) {
      console.error(error);
      setMessage(`${t('status.codex_features_save_failed')}: ${toErrorMessage(error)}`);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="h-full w-full overflow-auto p-6 lg:p-8" data-collaboration-id="PAGE_CODEX">
      <div className="w-full space-y-8">
        <WorkspacePageHeader
          title={t('codex.title')}
          subtitle={t('codex.feature_config_subtitle')}
          align="center"
        />

        <StatusCodexFeaturesSection
          t={t}
          snapshot={snapshot}
          rows={rows}
          preview={preview}
          message={message}
          query={query}
          stageFilter={stageFilter}
          dirtyCount={dirtyCount}
          isLoading={isLoading}
          isSaving={isSaving}
          onReload={() => void reload()}
          onChangeQuery={setQuery}
          onChangeStageFilter={setStageFilter}
          onToggleFeature={toggleFeature}
          onPreview={() => void previewChanges()}
          onSave={() => void saveChanges()}
          onReset={resetDraft}
        />
      </div>
    </div>
  );
}
