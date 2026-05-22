import { useCallback, useEffect, useMemo, useState } from 'react';
import { GetClaudeCodeMemoryFilesSnapshot, SaveClaudeCodeMemoryFile } from '../../../../wailsjs/go/main/App';
import type { main } from '../../../../wailsjs/go/models';
import { hasWailsAppBindings } from '../../../utils/previewMode';
import ClaudeCodeMemoryFilesPanel from '../components/ClaudeCodeMemoryFilesPanel';
import type { MemoryFilesPanelState } from '../components/ClaudeCodeMemoryFilesPanel';
import { previewAllFilesSnapshot, previewEmptySnapshot } from './previewData';

export default function ClaudeMdFeature() {
  const [snapshot, setSnapshot] = useState<main.ClaudeCodeMemoryFilesSnapshot>(previewAllFilesSnapshot);
  const [loadError, setLoadError] = useState('');
  const [editingPath, setEditingPath] = useState('');
  const [editContent, setEditContent] = useState('');
  const [savePreview, setSavePreview] = useState('');
  const [saveError, setSaveError] = useState('');
  const [saving, setSaving] = useState(false);

  const { files, warnings } = snapshot;

  const state = useMemo<MemoryFilesPanelState>(() => {
    const existing = files.filter((f) => f.exists);
    if (savePreview && !saving) return 'save-preview';
    if (warnings.some((w) => w.includes('not in .gitignore'))) return 'local-not-gitignored';
    if (warnings.some((w) => w.includes('depth'))) return 'import-depth-limit';
    if (warnings.some((w) => w.includes('import'))) return 'import-missing';
    if (existing.length === 0) return 'empty';
    if (files.every((f) => f.exists)) return 'all-files-present';
    return 'partial-files';
  }, [files, warnings, savePreview, saving]);

  const stateMessage = useMemo(() => {
    if (loadError) return loadError;
    if (warnings.length > 0) return warnings[0];
    return undefined;
  }, [loadError, warnings]);

  const loadSnapshot = useCallback(async () => {
    if (!hasWailsAppBindings()) {
      setSnapshot(previewAllFilesSnapshot);
      setLoadError('');
      return;
    }
    try {
      const result = await GetClaudeCodeMemoryFilesSnapshot();
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

  const handleStartEdit = useCallback((path: string, content: string) => {
    setEditingPath(path);
    setEditContent(content);
    setSavePreview('');
    setSaveError('');
  }, []);

  const handleCancelEdit = useCallback(() => {
    setEditingPath('');
    setEditContent('');
    setSavePreview('');
    setSaveError('');
  }, []);

  const handleSaveEdit = useCallback(async () => {
    if (!editingPath || !editContent) return;
    setSaving(true);
    setSaveError('');
    try {
      if (!hasWailsAppBindings()) {
        setSavePreview(editContent);
        setEditingPath('');
        return;
      }
      await SaveClaudeCodeMemoryFile({ path: editingPath, content: editContent });
      setSavePreview('');
      setEditingPath('');
      await loadSnapshot();
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : String(error));
    } finally {
      setSaving(false);
    }
  }, [editingPath, editContent, loadSnapshot]);

  return (
    <ClaudeCodeMemoryFilesPanel
      snapshot={snapshot}
      state={state}
      stateMessage={stateMessage}
      editingPath={editingPath}
      editContent={editContent}
      savePreview={savePreview}
      saveError={saveError}
      onStartEdit={handleStartEdit}
      onCancelEdit={handleCancelEdit}
      onChangeEditContent={setEditContent}
      onSaveEdit={handleSaveEdit}
    />
  );
}
