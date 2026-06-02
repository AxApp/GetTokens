import { useEffect, useMemo, useState } from 'react';
import SearchInput from '../../components/ui/SearchInput';
import WorkspacePageHeader from '../../components/ui/WorkspacePageHeader';
import { useDebug } from '../../context/useDebug';
import { useI18n } from '../../context/I18nContext';
import type { CodexWorkspace } from '../../types';
import { toErrorMessage } from '../../utils/error';
import {
  getCodexFeatureConfig,
  previewCodexFeatureConfig,
  saveCodexFeatureConfig,
} from '../status/api/codexFeatures';
import StatusCodexFeaturesSection from '../status/components/StatusCodexFeaturesSection';
import StatusCodexModelProvidersSection from '../status/components/StatusCodexModelProvidersSection';
import StatusCodexNoticeSection from '../status/components/StatusCodexNoticeSection';
import StatusCodexRootSettingsSection from '../status/components/StatusCodexRootSettingsSection';
import {
  buildCodexFeatureChangeInput,
  buildCodexFeatureDraft,
  selectCodexFeatureRows,
  type CodexConfigSection,
  setCodexFeatureDraftValue,
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
  const [rootPreview, setRootPreview] = useState<CodexFeaturePreview | null>(null);
  const [providerPreview, setProviderPreview] = useState<CodexFeaturePreview | null>(null);
  const [featurePreview, setFeaturePreview] = useState<CodexFeaturePreview | null>(null);
  const [noticePreview, setNoticePreview] = useState<CodexFeaturePreview | null>(null);
  const [rootMessage, setRootMessage] = useState('');
  const [providerMessage, setProviderMessage] = useState('');
  const [featureMessage, setFeatureMessage] = useState('');
  const [noticeMessage, setNoticeMessage] = useState('');
  const [query, setQuery] = useState('');
  const [stageFilter, setStageFilter] = useState<CodexFeatureStageFilter>('all');
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  function getMessageKey(
    sectionFilter: CodexConfigSection,
    key: 'loaded' | 'load_failed' | 'reset_done' | 'no_changes' | 'preview_ready' | 'preview_failed' | 'saved'
  ) {
    if (sectionFilter === 'root') {
      return `status.codex_root_settings_${key}`;
    }
    if (sectionFilter === 'model_providers') {
      return `status.codex_model_providers_${key}`;
    }
    return sectionFilter === 'notice' ? `status.codex_notices_${key}` : `status.codex_features_${key}`;
  }

  const rootRows = useMemo(
    () =>
      snapshot
        ? selectCodexFeatureRows(snapshot, draft, {
            query,
            sectionFilter: 'root',
          })
        : [],
    [draft, query, snapshot]
  );
  const providerRows = useMemo(
    () =>
      snapshot
        ? selectCodexFeatureRows(snapshot, draft, {
            query,
            sectionFilter: 'model_providers',
          })
        : [],
    [draft, query, snapshot]
  );
  const rows = useMemo(
    () =>
      snapshot
        ? selectCodexFeatureRows(snapshot, draft, {
            query,
            stageFilter,
            sectionFilter: 'features',
          })
        : [],
    [draft, query, snapshot, stageFilter]
  );
  const noticeRows = useMemo(
    () =>
      snapshot
        ? selectCodexFeatureRows(snapshot, draft, {
            query,
            sectionFilter: 'notice',
          })
        : [],
    [draft, query, snapshot]
  );
  const rootDirtyCount = useMemo(
    () =>
      snapshot
        ? selectCodexFeatureRows(snapshot, draft, { sectionFilter: 'root' }).filter((row) => row.dirty).length
        : 0,
    [draft, snapshot]
  );
  const providerDirtyCount = useMemo(
    () =>
      snapshot
        ? selectCodexFeatureRows(snapshot, draft, { sectionFilter: 'model_providers' }).filter((row) => row.dirty).length
        : 0,
    [draft, snapshot]
  );
  const featureDirtyCount = useMemo(
    () =>
      snapshot
        ? selectCodexFeatureRows(snapshot, draft, { stageFilter: 'all', sectionFilter: 'features' }).filter(
            (row) => row.dirty
          ).length
        : 0,
    [draft, snapshot]
  );
  const noticeDirtyCount = useMemo(
    () =>
      snapshot
        ? selectCodexFeatureRows(snapshot, draft, { sectionFilter: 'notice' }).filter((row) => row.dirty).length
        : 0,
    [draft, snapshot]
  );

  async function reload(sectionFilter: CodexConfigSection, messageOverride?: string) {
    setIsLoading(true);
    try {
      const nextSnapshot = await trackRequest('GetCodexFeatureConfig', { args: [] }, () =>
        getCodexFeatureConfig()
      );
      setSnapshot(nextSnapshot);
      setDraft(buildCodexFeatureDraft(nextSnapshot));
      setRootPreview(null);
      setProviderPreview(null);
      setFeaturePreview(null);
      setNoticePreview(null);
      setRootMessage(sectionFilter === 'root' ? messageOverride || t(getMessageKey('root', 'loaded')) : t(getMessageKey('root', 'loaded')));
      setProviderMessage(
        sectionFilter === 'model_providers'
          ? messageOverride || t(getMessageKey('model_providers', 'loaded'))
          : t(getMessageKey('model_providers', 'loaded'))
      );
      setFeatureMessage(
        sectionFilter === 'features'
          ? messageOverride || t(getMessageKey('features', 'loaded'))
          : t(getMessageKey('features', 'loaded'))
      );
      setNoticeMessage(
        sectionFilter === 'notice'
          ? messageOverride || t(getMessageKey('notice', 'loaded'))
          : t(getMessageKey('notice', 'loaded'))
      );
    } catch (error) {
      console.error(error);
      const nextMessage = `${t(getMessageKey(sectionFilter, 'load_failed'))}: ${toErrorMessage(error)}`;
      if (sectionFilter === 'root') {
        setRootMessage(nextMessage);
      } else if (sectionFilter === 'model_providers') {
        setProviderMessage(nextMessage);
      } else if (sectionFilter === 'features') {
        setFeatureMessage(nextMessage);
      } else {
        setNoticeMessage(nextMessage);
      }
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    if (workspace !== 'feature-config') {
      return;
    }
    void reload('features');
  }, [workspace]);

  function resetDraft() {
    if (!snapshot) {
      return;
    }
    setDraft(buildCodexFeatureDraft(snapshot));
    setRootPreview(null);
    setProviderPreview(null);
    setFeaturePreview(null);
    setNoticePreview(null);
    setRootMessage(t(getMessageKey('root', 'reset_done')));
    setProviderMessage(t(getMessageKey('model_providers', 'reset_done')));
    setFeatureMessage(t(getMessageKey('features', 'reset_done')));
    setNoticeMessage(t(getMessageKey('notice', 'reset_done')));
  }

  function updateDraftValue(key: string, value: unknown) {
    setDraft((prev) => setCodexFeatureDraftValue(prev, key, value));
    setRootPreview(null);
    setProviderPreview(null);
    setFeaturePreview(null);
    setNoticePreview(null);
    setRootMessage('');
    setProviderMessage('');
    setFeatureMessage('');
    setNoticeMessage('');
  }

  async function previewChanges(sectionFilter: CodexConfigSection) {
    if (!snapshot) {
      return null;
    }

    const input = buildCodexFeatureChangeInput(snapshot, draft, { sectionFilter });
    if (input.changes.length === 0 && Object.keys(input.values).length === 0) {
      if (sectionFilter === 'root') {
        setRootPreview(null);
        setRootMessage(t(getMessageKey('root', 'no_changes')));
      } else if (sectionFilter === 'model_providers') {
        setProviderPreview(null);
        setProviderMessage(t(getMessageKey('model_providers', 'no_changes')));
      } else if (sectionFilter === 'features') {
        setFeaturePreview(null);
        setFeatureMessage(t(getMessageKey('features', 'no_changes')));
      } else {
        setNoticePreview(null);
        setNoticeMessage(t(getMessageKey('notice', 'no_changes')));
      }
      return null;
    }

    try {
      const nextPreview = await trackRequest('PreviewCodexFeatureConfig', input, () =>
        previewCodexFeatureConfig(input, snapshot.configPath)
      );
      if (sectionFilter === 'root') {
        setRootPreview(nextPreview);
        setProviderPreview(null);
        setFeaturePreview(null);
        setNoticePreview(null);
        setRootMessage(t(getMessageKey('root', 'preview_ready')));
      } else if (sectionFilter === 'model_providers') {
        setRootPreview(null);
        setProviderPreview(nextPreview);
        setFeaturePreview(null);
        setNoticePreview(null);
        setProviderMessage(t(getMessageKey('model_providers', 'preview_ready')));
      } else if (sectionFilter === 'features') {
        setRootPreview(null);
        setFeaturePreview(nextPreview);
        setNoticePreview(null);
        setFeatureMessage(t(getMessageKey('features', 'preview_ready')));
      } else {
        setRootPreview(null);
        setNoticePreview(nextPreview);
        setFeaturePreview(null);
        setNoticeMessage(t(getMessageKey('notice', 'preview_ready')));
      }
      return { input, preview: nextPreview };
    } catch (error) {
      console.error(error);
      const nextMessage = `${t(getMessageKey(sectionFilter, 'preview_failed'))}: ${toErrorMessage(error)}`;
      if (sectionFilter === 'root') {
        setRootMessage(nextMessage);
      } else if (sectionFilter === 'model_providers') {
        setProviderMessage(nextMessage);
      } else if (sectionFilter === 'features') {
        setFeatureMessage(nextMessage);
      } else {
        setNoticeMessage(nextMessage);
      }
      return null;
    }
  }

  async function saveChanges(sectionFilter: CodexConfigSection) {
    if (!snapshot) {
      return;
    }

    setIsSaving(true);
    try {
      const previewResult = await previewChanges(sectionFilter);
      if (!previewResult) {
        return;
      }

      await trackRequest('SaveCodexFeatureConfig', previewResult.input, () =>
        saveCodexFeatureConfig(previewResult.input)
      );
      await reload(sectionFilter, t(getMessageKey(sectionFilter, 'saved')));
    } catch (error) {
      console.error(error);
      const nextMessage = `${t(`${sectionFilter === 'root' ? 'status.codex_root_settings' : sectionFilter === 'model_providers' ? 'status.codex_model_providers' : sectionFilter === 'notice' ? 'status.codex_notices' : 'status.codex_features'}_save_failed`)}: ${toErrorMessage(error)}`;
      if (sectionFilter === 'root') {
        setRootMessage(nextMessage);
      } else if (sectionFilter === 'model_providers') {
        setProviderMessage(nextMessage);
      } else if (sectionFilter === 'features') {
        setFeatureMessage(nextMessage);
      } else {
        setNoticeMessage(nextMessage);
      }
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div data-collaboration-id="PAGE_CODEX" className="h-full w-full overflow-auto p-6 lg:p-8 select-text">
      <div className="w-full space-y-8">
        <WorkspacePageHeader
          title={t('codex.title')}
          subtitle={t('codex.feature_config_subtitle')}
          align="center"
        />

        <section className="border-2 border-[var(--border-color)] bg-[var(--bg-surface)] p-4">
          <SearchInput
            value={query}
            onChange={setQuery}
            placeholder={t('status.codex_config_search_placeholder')}
            clearLabel={t('common.clear_search')}
          />
        </section>

        <StatusCodexRootSettingsSection
          t={t}
          snapshot={snapshot}
          rows={rootRows}
          preview={rootPreview}
          message={rootMessage}
          dirtyCount={rootDirtyCount}
          isLoading={isLoading}
          isSaving={isSaving}
          onReload={() => void reload('root')}
          onChangeSetting={updateDraftValue}
          onPreview={() => void previewChanges('root')}
          onSave={() => void saveChanges('root')}
          onReset={resetDraft}
        />

        <StatusCodexModelProvidersSection
          t={t}
          snapshot={snapshot}
          rows={providerRows}
          preview={providerPreview}
          message={providerMessage}
          dirtyCount={providerDirtyCount}
          isLoading={isLoading}
          isSaving={isSaving}
          onReload={() => void reload('model_providers')}
          onChangeSetting={updateDraftValue}
          onPreview={() => void previewChanges('model_providers')}
          onSave={() => void saveChanges('model_providers')}
          onReset={resetDraft}
        />

        <StatusCodexFeaturesSection
          t={t}
          snapshot={snapshot}
          rows={rows}
          preview={featurePreview}
          message={featureMessage}
          query={query}
          stageFilter={stageFilter}
          dirtyCount={featureDirtyCount}
          isLoading={isLoading}
          isSaving={isSaving}
          onReload={() => void reload('features')}
          onChangeQuery={setQuery}
          onChangeStageFilter={setStageFilter}
          showSearch={false}
          onChangeFeature={updateDraftValue}
          onPreview={() => void previewChanges('features')}
          onSave={() => void saveChanges('features')}
          onReset={resetDraft}
        />

        <StatusCodexNoticeSection
          t={t}
          snapshot={snapshot}
          rows={noticeRows}
          preview={noticePreview}
          message={noticeMessage}
          dirtyCount={noticeDirtyCount}
          isLoading={isLoading}
          isSaving={isSaving}
          onReload={() => void reload('notice')}
          onChangeNotice={updateDraftValue}
          onPreview={() => void previewChanges('notice')}
          onSave={() => void saveChanges('notice')}
          onReset={resetDraft}
        />
      </div>
    </div>
  );
}
