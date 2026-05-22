import { useCallback, useEffect, useMemo, useState } from 'react';
import { GetClaudeCodeSettingsSnapshot, PatchClaudeCodeSettings } from '../../../../wailsjs/go/main/App';
import type { main } from '../../../../wailsjs/go/models';
import { useI18n } from '../../../context/I18nContext';
import { hasWailsAppBindings } from '../../../utils/previewMode';
import ClaudeCodeSettingsScopeStack from '../components/ClaudeCodeSettingsScopeStack';
import type { SettingsScopeStackState } from '../components/ClaudeCodeSettingsScopeStack';
import { previewAllLayersSnapshot, previewEmptySnapshot } from './previewData';

export default function SettingsFeature() {
  const { t } = useI18n();
  const [snapshot, setSnapshot] = useState<main.ClaudeCodeSettingsSnapshotDTO>(previewAllLayersSnapshot);
  const [loadError, setLoadError] = useState('');
  const [editingScope, setEditingScope] = useState('');
  const [savePreview, setSavePreview] = useState('');
  const [saveError, setSaveError] = useState('');
  const [saving, setSaving] = useState(false);

  const { layers } = snapshot;

  const state = useMemo<SettingsScopeStackState>(() => {
    const hasAny = layers.some((l) => l.exists);
    const hasErrors = layers.some((l) => l.parseError);
    if (hasErrors) return 'parse-error';
    if (!hasAny) return 'all-layers-empty';
    if (savePreview && !saving) return 'saving-diff';
    if (layers.every((l) => l.exists)) return 'all-layers-valid';
    return 'partial-layers';
  }, [layers, savePreview, saving]);

  const stateMessage = useMemo(() => loadError || undefined, [loadError]);

  const loadSnapshot = useCallback(async () => {
    if (!hasWailsAppBindings()) {
      setSnapshot(previewAllLayersSnapshot);
      setLoadError('');
      return;
    }
    try {
      const result = await GetClaudeCodeSettingsSnapshot();
      setSnapshot(result);
      setLoadError('');
    } catch (error) {
      console.error(error);
      setSnapshot(previewEmptySnapshot);
      setLoadError(error instanceof Error ? error.message : String(error));
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    loadSnapshot().then(() => { if (cancelled) return; }).catch(() => {});
    return () => { cancelled = true; };
  }, [loadSnapshot]);

  const handleStartEdit = useCallback((scope: string) => {
    setEditingScope(scope);
    setSavePreview('');
    setSaveError('');
  }, []);

  const handleCancelEdit = useCallback(() => {
    setEditingScope('');
    setSavePreview('');
    setSaveError('');
  }, []);

  const handleSavePatch = useCallback(async (patches: Record<string, any>) => {
    if (!editingScope) return;
    const layer = snapshot.layers.find((l) => l.scope === editingScope);
    if (!layer) return;

    setSaving(true);
    setSaveError('');
    try {
      if (!hasWailsAppBindings()) {
        setSavePreview(JSON.stringify(patches, null, 2));
        setEditingScope('');
        return;
      }
      const result = await PatchClaudeCodeSettings({
        scope: editingScope,
        path: layer.path,
        patches,
      });
      setSavePreview(result.preview);
      setEditingScope('');
      await loadSnapshot();
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : String(error));
    } finally {
      setSaving(false);
    }
  }, [editingScope, snapshot.layers, loadSnapshot]);

  const handleToggleAttributionHeader = useCallback(async (scope: string, enabled: boolean) => {
    const layer = snapshot.layers.find((l) => l.scope === scope);
    if (!layer || !layer.path || !layer.knownFields?.env) return;

    setSaving(true);
    setSaveError('');
    try {
      const currentEnv = { ...layer.knownFields.env };
      if (enabled) {
        currentEnv['CLAUDE_CODE_ATTRIBUTION_HEADER'] = '0';
      } else {
        delete currentEnv['CLAUDE_CODE_ATTRIBUTION_HEADER'];
      }

      if (!hasWailsAppBindings()) {
        setSavePreview(JSON.stringify({ env: currentEnv }, null, 2));
        setEditingScope('');
        return;
      }

      const result = await PatchClaudeCodeSettings({
        scope: scope as any,
        path: layer.path,
        patches: { env: currentEnv },
      });
      setSavePreview(result.preview);
      setEditingScope('');
      await loadSnapshot();
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : String(error));
    } finally {
      setSaving(false);
    }
  }, [snapshot.layers, loadSnapshot]);

  return (
    <ClaudeCodeSettingsScopeStack
      snapshot={snapshot}
      state={state}
      stateMessage={stateMessage}
      editingScope={editingScope}
      onStartEdit={handleStartEdit}
      onCancelEdit={handleCancelEdit}
      onSavePatch={handleSavePatch}
      onToggleAttributionHeader={handleToggleAttributionHeader}
      attributionHeaderLabel={t('claude_code.attribution_header')}
      savePreview={savePreview}
      saveError={saveError}
    />
  );
}
