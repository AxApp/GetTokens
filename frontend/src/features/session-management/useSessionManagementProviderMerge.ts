import { useCallback, useMemo, useState } from 'react';
import { updateCodexSessionProviders } from './api.ts';
import { persistSessionManagementSnapshot } from './cache.ts';
import type { ProjectSummary, SessionManagementSnapshot } from './model.ts';
import type { ProviderMergeRow } from './SessionManagementView.tsx';
import { getProviderDisplayLabel } from './SessionManagementView.tsx';
import { normalizeProviderInput, toErrorMessage } from './sessionManagementUtils.ts';

interface UseSessionManagementProviderMergeOptions {
  projects: ProjectSummary[];
  unknownProviderLabel: string;
  loadFailedMessage: string;
  onSnapshotUpdated: (snapshot: SessionManagementSnapshot) => void;
}

export function useSessionManagementProviderMerge({
  projects,
  unknownProviderLabel,
  loadFailedMessage,
  onSnapshotUpdated,
}: UseSessionManagementProviderMergeOptions) {
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [providerDraft, setProviderDraft] = useState<Record<string, string>>({});
  const [providerSaving, setProviderSaving] = useState(false);
  const [providerEditorError, setProviderEditorError] = useState<string | null>(null);

  const editingProject = useMemo(
    () => projects.find((project) => project.id === editingProjectId) ?? null,
    [editingProjectId, projects],
  );

  const editingProjectProviderRows = useMemo<ProviderMergeRow[]>(() => {
    if (!editingProject) {
      return [];
    }

    const counts = new Map<string, { sourceProvider: string; count: number }>();
    for (const session of editingProject.sessions) {
      const sourceProvider = session.provider;
      const key = normalizeProviderInput(sourceProvider, unknownProviderLabel);
      const previous = counts.get(key);
      if (previous) {
        previous.count += 1;
        continue;
      }
      counts.set(key, { sourceProvider, count: 1 });
    }

    return Array.from(counts.entries())
      .map(([sourceKey, entry]) => ({
        sourceKey,
        sourceProvider: entry.sourceProvider,
        count: entry.count,
        targetProvider:
          providerDraft[sourceKey] ??
          getProviderDisplayLabel(entry.sourceProvider, unknownProviderLabel),
      }))
      .sort((left, right) => {
        if (left.count === right.count) {
          return left.sourceProvider.localeCompare(right.sourceProvider);
        }
        return right.count - left.count;
      });
  }, [editingProject, providerDraft, unknownProviderLabel]);

  const editingProjectProviderCandidates = useMemo(() => {
    if (!editingProjectProviderRows.length) {
      return [];
    }

    return Array.from(
      new Set(
        editingProjectProviderRows
          .flatMap((row) => [row.sourceProvider, row.targetProvider])
          .map((provider) => getProviderDisplayLabel(provider, unknownProviderLabel))
          .filter(Boolean),
      ),
    ).sort((left, right) => left.localeCompare(right));
  }, [editingProjectProviderRows, unknownProviderLabel]);

  const openProviderEditor = useCallback((projectID: string) => {
    setEditingProjectId(projectID);
    setProviderDraft({});
    setProviderEditorError(null);
  }, []);

  const closeProviderEditor = useCallback(() => {
    setEditingProjectId(null);
    setProviderDraft({});
    setProviderEditorError(null);
  }, []);

  const resetProviderDraft = useCallback(() => {
    setProviderDraft({});
    setProviderEditorError(null);
  }, []);

  const updateDraftValue = useCallback((sourceKey: string, value: string) => {
    setProviderDraft((current) => ({
      ...current,
      [sourceKey]: value,
    }));
  }, []);

  const saveProviderMerge = useCallback(async () => {
    if (!editingProject || providerSaving) {
      return;
    }

    const mappings = editingProjectProviderRows
      .map((row) => ({
        sourceProvider: normalizeProviderInput(row.sourceProvider, unknownProviderLabel),
        targetProvider: normalizeProviderInput(row.targetProvider, unknownProviderLabel),
      }))
      .filter((item) => item.sourceProvider !== item.targetProvider);

    if (!mappings.length) {
      closeProviderEditor();
      return;
    }

    setProviderSaving(true);
    setProviderEditorError(null);
    try {
      const nextSnapshot = await updateCodexSessionProviders(editingProject.id, mappings);
      persistSessionManagementSnapshot(nextSnapshot);
      onSnapshotUpdated(nextSnapshot);
      closeProviderEditor();
    } catch (error) {
      setProviderEditorError(toErrorMessage(error, loadFailedMessage));
    } finally {
      setProviderSaving(false);
    }
  }, [
    closeProviderEditor,
    editingProject,
    editingProjectProviderRows,
    loadFailedMessage,
    onSnapshotUpdated,
    providerSaving,
    unknownProviderLabel,
  ]);

  return {
    editingProject,
    editingProjectId,
    editingProjectProviderRows,
    editingProjectProviderCandidates,
    providerSaving,
    providerEditorError,
    openProviderEditor,
    closeProviderEditor,
    resetProviderDraft,
    updateDraftValue,
    saveProviderMerge,
  };
}
