import { useCallback, useEffect, useMemo, useState } from 'react';
import { GetClaudeCodeSubagentsSnapshot, SaveClaudeCodeSubagent, DeleteClaudeCodeSubagent } from '../../../../wailsjs/go/main/App';
import type { main } from '../../../../wailsjs/go/models';
import { hasWailsAppBindings } from '../../../utils/previewMode';
import ClaudeCodeSubagentCatalog from '../components/ClaudeCodeSubagentCatalog';
import type { SubagentCatalogState } from '../components/ClaudeCodeSubagentCatalog';
import { previewFullSnapshot, previewEmptySnapshot } from './previewData';

type AgentRecord = main.ClaudeCodeSubagentRecordDTO;

export default function SubagentsFeature() {
  const [snapshot, setSnapshot] = useState<main.ClaudeCodeSubagentsSnapshotDTO>(previewFullSnapshot);
  const [loadError, setLoadError] = useState('');
  const [creatingNew, setCreatingNew] = useState(false);
  const [editingPath, setEditingPath] = useState('');
  const [draftName, setDraftName] = useState('');
  const [draftDescription, setDraftDescription] = useState('');
  const [draftBody, setDraftBody] = useState('');
  const [draftScope, setDraftScope] = useState('user');
  const [savePreview, setSavePreview] = useState('');
  const [saveError, setSaveError] = useState('');
  const [saving, setSaving] = useState(false);

  const { agents, warnings = [] } = snapshot;

  const state = useMemo<SubagentCatalogState>(() => {
    if (creatingNew) return 'creating-agent';
    if (saving) return 'saving-agent';
    const hasParseError = agents.some((a: AgentRecord) => a.frontmatterError);
    if (hasParseError) return 'parse-error';
    if (agents.some((a: AgentRecord) => !a.frontmatterValid && a.validationErrors?.some((e: string) => e.includes('name')))) return 'missing-name';
    if (agents.some((a: AgentRecord) => !a.frontmatterValid && a.validationErrors?.some((e: string) => e.includes('description')))) return 'missing-description';
    if (agents.length === 0) return 'empty';
    if (agents.some((a: AgentRecord) => a.isPlugin)) return 'plugin-ignored-fields';
    const errorCount = agents.filter((a: AgentRecord) => !a.frontmatterValid).length;
    if (errorCount > 0) return 'parse-error';
    return 'valid-agents';
  }, [agents, creatingNew, saving]);

  const stateMessage = useMemo(() => {
    if (loadError) return loadError;
    if (warnings.length > 0) return warnings[0];
    return undefined;
  }, [loadError, warnings]);

  const loadSnapshot = useCallback(async () => {
    if (!hasWailsAppBindings()) {
      setSnapshot(previewFullSnapshot);
      setLoadError('');
      return;
    }
    try {
      const result = await GetClaudeCodeSubagentsSnapshot();
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

  const handleStartCreate = useCallback(() => {
    setCreatingNew(true);
    setEditingPath('');
    setDraftName('');
    setDraftDescription('');
    setDraftBody('');
    setDraftScope('user');
    setSavePreview('');
    setSaveError('');
  }, []);

  const handleCancelCreate = useCallback(() => {
    setCreatingNew(false);
    setDraftName('');
    setDraftDescription('');
    setDraftBody('');
  }, []);

  const handleStartEdit = useCallback((agent: AgentRecord) => {
    setEditingPath(agent.path);
    setDraftName(agent.name);
    setDraftDescription(agent.description);
    setDraftBody(agent.body ?? '');
    setDraftScope(agent.scope);
    setSavePreview('');
    setSaveError('');
  }, []);

  const handleCancelEdit = useCallback(() => {
    setEditingPath('');
    setDraftName('');
    setDraftDescription('');
    setDraftBody('');
    setSavePreview('');
    setSaveError('');
  }, []);

  const handleSaveAgent = useCallback(async () => {
    if (!draftName || !draftDescription) return;
    setSaving(true);
    setSaveError('');
    try {
      if (!hasWailsAppBindings()) {
        const preview = `---\nname: ${draftName}\ndescription: ${draftDescription}\n---\n\n${draftBody}`;
        setSavePreview(preview);
        setEditingPath('');
        setCreatingNew(false);
        return;
      }
      const existingAgent = agents.find((a: AgentRecord) => a.path === editingPath);
      await SaveClaudeCodeSubagent({
        scope: creatingNew ? draftScope : existingAgent?.scope ?? 'user',
        path: editingPath,
        name: draftName,
        description: draftDescription,
        knownFields: existingAgent?.knownFields,
        unknownFields: existingAgent?.unknownFields,
        body: draftBody,
      });
      setSavePreview('');
      setEditingPath('');
      setCreatingNew(false);
      await loadSnapshot();
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : String(error));
    } finally {
      setSaving(false);
    }
  }, [draftName, draftDescription, draftBody, draftScope, creatingNew, editingPath, agents, loadSnapshot]);

  const handleDeleteAgent = useCallback(async (agent: AgentRecord) => {
    if (!hasWailsAppBindings()) {
      setSnapshot((prev: main.ClaudeCodeSubagentsSnapshotDTO) => {
        const filtered = prev.agents.filter((a: AgentRecord) => a.path !== agent.path);
        return { ...prev, agents: filtered } as unknown as main.ClaudeCodeSubagentsSnapshotDTO;
      });
      return;
    }
    try {
      await DeleteClaudeCodeSubagent({ scope: agent.scope, path: agent.path });
      await loadSnapshot();
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : String(error));
    }
  }, [loadSnapshot]);

  return (
    <ClaudeCodeSubagentCatalog
      snapshot={snapshot}
      state={state}
      stateMessage={stateMessage}
      creatingNew={creatingNew}
      editingPath={editingPath}
      draftName={draftName}
      draftDescription={draftDescription}
      draftBody={draftBody}
      savePreview={savePreview}
      saveError={saveError}
      onStartCreate={handleStartCreate}
      onCancelCreate={handleCancelCreate}
      onStartEdit={handleStartEdit}
      onCancelEdit={handleCancelEdit}
      onChangeDraftName={setDraftName}
      onChangeDraftDescription={setDraftDescription}
      onChangeDraftBody={setDraftBody}
      onSaveAgent={handleSaveAgent}
      onDeleteAgent={handleDeleteAgent}
    />
  );
}
