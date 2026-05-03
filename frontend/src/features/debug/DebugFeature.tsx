import DebugEmptyState from './components/DebugEmptyState';
import DebugEntryCard from './components/DebugEntryCard';
import DebugHeader from './components/DebugHeader';
import { useDebugFeature } from './hooks/useDebugFeature';

export default function DebugFeature() {
  const {
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
    clearAll,
  } = useDebugFeature();

  return (
    <div className="h-full w-full overflow-auto p-12" data-collaboration-id="PAGE_DEBUG">
      <div className="mx-auto max-w-6xl space-y-8 pb-24">
        <DebugHeader
          count={sortedEntries.length}
          allSelected={allSelected}
          selectedCount={selectedEntries.length}
          copyState={copyState}
          onToggleSelectAll={toggleSelectAll}
          onClearSelection={clearSelection}
          onCopySelected={copySelectedEntries}
          onClearAll={clearAll}
        />

        {sortedEntries.length === 0 ? (
          <DebugEmptyState />
        ) : (
          <div className="space-y-6">
            {entryViewModels.map((entry) => (
              <DebugEntryCard
                key={entry.id}
                entry={entry}
                isSelected={selectedIDs.includes(entry.id)}
                onToggleEntry={toggleEntry}
                onToggleExpanded={toggleExpanded}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
