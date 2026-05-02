import { useEffect, useMemo, useState } from 'react';
import { useDebug } from '../../../context/DebugContext';
import { buildDebugEntryViewModels } from '../model/debugModel';

export function useDebugFeature() {
  const { entries, clearEntries } = useDebug();
  const [selectedIDs, setSelectedIDs] = useState<string[]>([]);
  const [expandedIDs, setExpandedIDs] = useState<string[]>([]);
  const [copyState, setCopyState] = useState<'idle' | 'success' | 'error'>('idle');

  const sortedEntries = useMemo(() => entries, [entries]);
  const selectedEntries = useMemo(
    () => sortedEntries.filter((entry) => selectedIDs.includes(entry.id)),
    [selectedIDs, sortedEntries]
  );
  const entryViewModels = useMemo(
    () => buildDebugEntryViewModels(sortedEntries, { expandedIDs }),
    [expandedIDs, sortedEntries]
  );
  const allSelected = sortedEntries.length > 0 && selectedIDs.length === sortedEntries.length;

  useEffect(() => {
    setSelectedIDs((prev) => prev.filter((id) => sortedEntries.some((entry) => entry.id === id)));
  }, [sortedEntries]);
  useEffect(() => {
    setExpandedIDs((prev) => prev.filter((id) => sortedEntries.some((entry) => entry.id === id)));
  }, [sortedEntries]);

  useEffect(() => {
    if (copyState === 'idle') {
      return;
    }
    const timer = window.setTimeout(() => setCopyState('idle'), 1600);
    return () => window.clearTimeout(timer);
  }, [copyState]);

  function toggleEntry(id: string) {
    setSelectedIDs((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));
  }

  function toggleSelectAll() {
    setSelectedIDs(allSelected ? [] : sortedEntries.map((entry) => entry.id));
  }

  function toggleExpanded(id: string) {
    setExpandedIDs((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));
  }

  function clearSelection() {
    setSelectedIDs([]);
  }

  async function copySelectedEntries() {
    if (selectedEntries.length === 0) {
      return;
    }

    const payload = selectedEntries.map((entry) => ({
      id: entry.id,
      name: entry.name,
      transport: entry.transport,
      status: entry.status,
      startedAt: entry.startedAt,
      endedAt: entry.endedAt,
      durationMs: entry.durationMs,
      request: entry.request,
      response: entry.response,
      error: entry.error,
    }));

    try {
      await navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
      setCopyState('success');
    } catch {
      setCopyState('error');
    }
  }

  return {
    sortedEntries,
    selectedIDs,
    selectedEntries,
    entryViewModels,
    allSelected,
    copyState,
    toggleEntry,
    toggleSelectAll,
    toggleExpanded,
    clearSelection,
    copySelectedEntries,
    clearAll: clearEntries,
  };
}
