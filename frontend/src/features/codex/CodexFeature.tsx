import { useEffect, useMemo, useRef, useState } from 'react';
import { Button, Input, Modal, Select, Tree } from 'antd';
import type { TreeDataNode, TreeProps } from 'antd';
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
import {
  buildCodexFeatureChangeInput,
  buildCodexFeatureDraft,
  groupCodexFeatureRows,
  markCodexFeatureDraftPresent,
  removeCodexFeatureDraftValue,
  resolveCodexFeatureRowPathDisplay,
  selectCodexFeatureRows,
  type CodexConfigSection,
  type CodexFeatureRow,
  setCodexFeatureDraftValue,
  type CodexFeatureConfigSnapshot,
  type CodexFeatureDraft,
  type CodexFeaturePreview,
  type CodexFeatureStageFilter,
} from '../status/model/codexFeatureConfig';
import { renderCodexValueEditor } from '../status/model/codexValueEditor';
import { selectCodexValueEditorKind } from '../status/model/codexValueEditorModel';

interface AutoWidthInputProps {
  value: string;
  disabled?: boolean;
  onChange: (value: string) => void;
}

function resolveAutoWidthInputCh(value: string) {
  return Math.min(48, Math.max(8, value.length + 2));
}

function AutoWidthInput({ value, disabled = false, onChange }: AutoWidthInputProps) {
  return (
    <div className="inline-block">
      <Input
        size="small"
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className="font-mono"
        style={{ width: `${resolveAutoWidthInputCh(value)}ch` }}
      />
    </div>
  );
}

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

  // Tree state
  const [expandedKeys, setExpandedKeys] = useState<React.Key[]>([]);
  const [autoExpandParent, setAutoExpandParent] = useState(true);
  const rowMap = useMemo(() => new Map<string, CodexFeatureRow>(), []);
  const descendantRowsMap = useMemo(() => new Map<string, CodexFeatureRow[]>(), []);

  // Edit modal state
  const [editingRow, setEditingRow] = useState<CodexFeatureRow | null>(null);
  const [editValue, setEditValue] = useState('');

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

  const allRows = useMemo(
    () =>
      snapshot
        ? selectCodexFeatureRows(snapshot, draft, { query, stageFilter })
        : [],
    [draft, query, snapshot, stageFilter]
  );

  const totalDirtyCount = useMemo(
    () =>
      snapshot
        ? selectCodexFeatureRows(snapshot, draft, { stageFilter: 'all' }).filter((row) => row.dirty).length
        : 0,
    [draft, snapshot]
  );

  const sectionTitleKeys: Record<CodexConfigSection, string> = {
    root: 'status.codex_root_settings_title',
    features: 'status.codex_features_title',
    notice: 'status.codex_notices_title',
    model_providers: 'status.codex_model_providers_title',
  };

  const sectionOrder: CodexConfigSection[] = ['root', 'features', 'notice', 'model_providers'];

  function resolveGroupTitle(section: CodexConfigSection, groupId: string) {
    const prefix =
      section === 'root'
        ? 'status.codex_root_group_'
        : section === 'features'
          ? 'status.codex_features_group_'
          : section === 'notice'
            ? 'status.codex_notices_group_'
            : 'status.codex_model_providers_group_';
    const key = `${prefix}${groupId}`;
    const translated = t(key);
    return translated !== key ? translated : groupId;
  }

  /** Resolve the hierarchical labels from a row's key/path, handling dot-separated keys. */
  function resolveRowParts(row: CodexFeatureRow): { parent: string; child: string | null } {
    const display = resolveCodexFeatureRowPathDisplay(row);
    if (display.childLabels.length > 0) {
      return { parent: display.primaryLabel, child: display.childLabels.join('/') };
    }
    // Fallback: split dotted key for hierarchy
    const parts = row.key.split('.');
    if (parts.length >= 2) {
      return { parent: parts[0], child: parts.slice(1).join('/') };
    }
    return { parent: display.primaryLabel, child: null };
  }

  function buildTreeData(): { treeData: TreeDataNode[]; initialExpanded: string[]; checkedKeys: string[] } {
    rowMap.clear();
    descendantRowsMap.clear();
    const groups = groupCodexFeatureRows(allRows);
    const sectionMap = new Map<CodexConfigSection, TreeDataNode>();
    const initialExpanded = new Set<string>();
    const checkedKeys = new Set<string>();

    function rememberRows(key: string, rows: CodexFeatureRow[]) {
      descendantRowsMap.set(key, rows);
      if (rows.some((row) => row.localRecordPresent)) {
        checkedKeys.add(key);
      }
    }

    function rememberLeaf(key: string, row: CodexFeatureRow) {
      rowMap.set(key, row);
      descendantRowsMap.set(key, [row]);
      if (row.localRecordPresent) {
        checkedKeys.add(key);
      }
    }

    for (const section of sectionOrder) {
      sectionMap.set(section, {
        title: t(sectionTitleKeys[section]),
        key: `section-${section}`,
        children: [],
      });
    }

    for (const group of groups) {
      const sectionNode = sectionMap.get(group.section);
      if (!sectionNode) continue;

      // Group rows by parent label
      const parentMap = new Map<string, CodexFeatureRow[]>();
      for (const row of group.rows) {
        const parts = resolveRowParts(row);
        const list = parentMap.get(parts.parent) || [];
        list.push(row);
        parentMap.set(parts.parent, list);
      }

      const groupChildren: TreeDataNode[] = [];

      for (const [parentLabel, rows] of parentMap) {
        if (rows.length === 1) {
          const row = rows[0];
          const parts = resolveRowParts(row);
          if (parts.child) {
            const childKey = `${row.id}-child`;
            rememberLeaf(childKey, row);
            const parentKey = `parent-${group.section}-${parentLabel}`;
            groupChildren.push({
              title: parentLabel,
              key: parentKey,
              children: [{ title: parts.child, key: childKey, isLeaf: true }],
            });
            rememberRows(parentKey, [row]);
            if (row.localRecordPresent) {
              initialExpanded.add(parentKey);
            }
          } else {
            rememberLeaf(row.id, row);
            groupChildren.push({ title: parentLabel, key: row.id, isLeaf: true });
          }
        } else {
          const parentKey = `parent-${group.section}-${parentLabel}`;
          const parentChildren: TreeDataNode[] = [];
          let anyLocal = false;
          for (const row of rows) {
            const parts = resolveRowParts(row);
            if (parts.child) {
              const childKey = `${row.id}-child`;
              rememberLeaf(childKey, row);
              parentChildren.push({ title: parts.child, key: childKey, isLeaf: true });
              if (row.localRecordPresent) {
                anyLocal = true;
              }
            } else {
              rememberLeaf(row.id, row);
              parentChildren.push({ title: row.key, key: row.id, isLeaf: true });
              if (row.localRecordPresent) {
                anyLocal = true;
              }
            }
          }
          groupChildren.push({
            title: parentLabel,
            key: parentKey,
            children: parentChildren,
          });
          rememberRows(parentKey, rows);
          if (anyLocal) {
            initialExpanded.add(parentKey);
          }
        }
      }

      rememberRows('section-' + group.section, group.rows);
      if (groupChildren.length === 1) {
        (sectionNode.children as TreeDataNode[]).push(groupChildren[0]);
      } else {
        const groupKey = 'group-' + group.section + '-' + group.id;
        (sectionNode.children as TreeDataNode[]).push({
          title: resolveGroupTitle(group.section, group.id),
          key: groupKey,
          children: groupChildren,
        });
        rememberRows(groupKey, group.rows);
      }
    }

    return {
      treeData: sectionOrder
        .map((s) => sectionMap.get(s)!)
        .filter((node) => (node.children as TreeDataNode[]).length > 0),
      initialExpanded: Array.from(initialExpanded),
      checkedKeys: Array.from(checkedKeys),
    };
  }

  const treeResult = useMemo(buildTreeData, [allRows, t]);
  const treeData = treeResult.treeData;

  // Initialize expanded/checked keys from hasLocalValue on first load
  const initRef = useRef(true);
  useEffect(() => {
    if (initRef.current && snapshot) {
      setExpandedKeys(treeResult.initialExpanded);
      initRef.current = false;
    }
  }, [snapshot, treeResult.initialExpanded]);

  const onExpand: TreeProps['onExpand'] = (expandedKeysValue) => {
    setExpandedKeys(expandedKeysValue);
    setAutoExpandParent(false);
  };

  function resolvePresentValue(row: CodexFeatureRow) {
    if (typeof row.draftValue !== 'undefined') return row.draftValue;
    if (typeof row.effectiveValue !== 'undefined') return row.effectiveValue;
    return row.defaultValue;
  }

  function clearConfigFeedback() {
    setRootPreview(null);
    setProviderPreview(null);
    setFeaturePreview(null);
    setNoticePreview(null);
    setRootMessage('');
    setProviderMessage('');
    setFeatureMessage('');
    setNoticeMessage('');
  }

  const onCheck: TreeProps['onCheck'] = (_checkedKeysValue, info) => {
    const nodeKey = String(info.node.key);
    const row = rowMap.get(nodeKey);
    clearConfigFeedback();

    if (row) {
      setDraft((prev) =>
        info.checked
          ? markCodexFeatureDraftPresent(prev, row.id, resolvePresentValue(row), row.hasLocalValue)
          : removeCodexFeatureDraftValue(prev, row.id, row.hasLocalValue)
      );
      return;
    }

    const descendantRows = descendantRowsMap.get(nodeKey) || [];
    if (!info.checked && descendantRows.length > 0) {
      setDraft((prev) =>
        descendantRows.reduce(
          (nextDraft, descendantRow) => removeCodexFeatureDraftValue(nextDraft, descendantRow.id, descendantRow.hasLocalValue),
          prev
        )
      );
      return;
    }

    if (info.checked) {
      setExpandedKeys((prev) => Array.from(new Set([...prev, nodeKey])));
      setAutoExpandParent(false);
    }
  };

  function openEditModal(row: CodexFeatureRow) {
    setEditingRow(row);
    setEditValue(stringifyEditValue(row.draftValue));
  }

  function stringifyEditValue(value: unknown): string {
    if (value === null || typeof value === 'undefined') return '';
    if (Array.isArray(value)) return value.map(String).join('\n');
    if (typeof value === 'object') return JSON.stringify(value, null, 2);
    return String(value);
  }

  function parseEditValue(raw: string, row: CodexFeatureRow): unknown {
    if (row.valueType === 'boolean' || row.valueType === 'bool') {
      return raw.trim().toLowerCase() === 'true';
    }
    if (row.valueType === 'integer') {
      return raw === '' ? '' : parseInt(raw, 10);
    }
    if (row.valueType === 'number') {
      return raw === '' ? '' : Number(raw);
    }
    if (row.valueType === 'string_array') {
      return raw.split('\n').map((s) => s.trim()).filter(Boolean);
    }
    return raw;
  }

  function handleEditSave() {
    if (editingRow) {
      updateDraftValue(editingRow.id, parseEditValue(editValue, editingRow));
    }
    setEditingRow(null);
  }

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
    clearConfigFeedback();
  }

  function removeDraftValue(key: string) {
    const row = allRows.find((item) => item.id === key || item.key === key);
    setDraft((prev) => removeCodexFeatureDraftValue(prev, key, row?.hasLocalValue ?? true));
    clearConfigFeedback();
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

  async function previewAllChanges() {
    if (!snapshot) {
      return null;
    }

    const input = buildCodexFeatureChangeInput(snapshot, draft);
    if (input.changes.length === 0 && Object.keys(input.values).length === 0) {
      setFeaturePreview(null);
      setFeatureMessage(t(getMessageKey('features', 'no_changes')));
      return null;
    }

    try {
      const nextPreview = await trackRequest('PreviewCodexFeatureConfig', input, () =>
        previewCodexFeatureConfig(input, snapshot.configPath)
      );
      setRootPreview(null);
      setProviderPreview(null);
      setFeaturePreview(nextPreview);
      setNoticePreview(null);
      setFeatureMessage(t(getMessageKey('features', 'preview_ready')));
      return { input, preview: nextPreview };
    } catch (error) {
      console.error(error);
      setFeatureMessage(`${t(getMessageKey('features', 'preview_failed'))}: ${toErrorMessage(error)}`);
      return null;
    }
  }

  async function saveAllChanges() {
    if (!snapshot) {
      return;
    }

    setIsSaving(true);
    try {
      const previewResult = await previewAllChanges();
      if (!previewResult) {
        return;
      }

      await trackRequest('SaveCodexFeatureConfig', previewResult.input, () =>
        saveCodexFeatureConfig(previewResult.input)
      );
      await reload('features', t(getMessageKey('features', 'saved')));
    } catch (error) {
      console.error(error);
      setFeatureMessage(`${t('status.codex_features_save_failed')}: ${toErrorMessage(error)}`);
    } finally {
      setIsSaving(false);
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
          actions={
            <>
              <Button size="small" onClick={resetDraft} disabled={isLoading || !snapshot}>
                {t('status.codex_features_reset')}
              </Button>
              <Button size="small" onClick={() => void previewAllChanges()} disabled={isLoading || totalDirtyCount === 0}>
                {t('status.codex_features_preview')}
              </Button>
              <Button type="primary" size="small" onClick={() => void saveAllChanges()} disabled={isLoading || totalDirtyCount === 0}>
                {isSaving ? t('status.codex_features_saving') : t('common.save')}
              </Button>
            </>
          }
        />

        <section className="-mt-4 mb-4">
          <SearchInput
            value={query}
            onChange={setQuery}
            placeholder={t('status.codex_config_search_placeholder')}
            clearLabel={t('common.clear_search')}
          />
        </section>

        <div className="rounded border border-[var(--gt-border-subtle)] bg-[var(--gt-surface-canvas)] p-4">
          <Tree
            checkable
            checkStrictly
            defaultExpandAll
            onExpand={onExpand}
            expandedKeys={expandedKeys}
            autoExpandParent={autoExpandParent}
            onCheck={onCheck}
            checkedKeys={treeResult.checkedKeys}
            treeData={treeData}
            titleRender={(node) => {
              const row = rowMap.get(node.key as string);
              if (!row) {
                return <span className="font-semibold text-[var(--gt-ink-primary)]">{node.title as string}</span>;
              }
              const editorKind = selectCodexValueEditorKind(row);
              const disabled = row.readOnly || isLoading || !row.localRecordPresent;
              const isSegment = editorKind === 'segment';
              const isToggle = editorKind === 'toggle';
              const isLongText = editorKind === 'textarea' || editorKind === 'string_array';
              const segmentOptions = row.options.map((opt) => ({ label: opt, value: opt }));
              const nodeTitle = String(node.title);
              return (
                <div className="flex items-center gap-2 py-1">
                  <span className="font-mono text-[var(--gt-font-size-sm)] text-[var(--gt-ink-primary)]">
                    {nodeTitle}
                  </span>
                  {isSegment ? (
                    <Select
                      size="small"
                      value={String(row.draftValue ?? '')}
                      options={segmentOptions}
                      disabled={disabled}
                      onChange={(val) => updateDraftValue(row.id, val)}
                      className="w-40"
                    />
                  ) : isToggle ? (
                    renderCodexValueEditor(row, disabled, updateDraftValue)
                  ) : isLongText ? (
                    <span
                      className={`min-w-0 flex-1 truncate rounded border border-[var(--gt-border-subtle)] px-2 py-0.5 font-mono text-[var(--gt-font-size-xs)] text-[var(--gt-ink-muted)] ${disabled ? 'opacity-60' : 'cursor-pointer hover:border-[var(--gt-border-strong)] hover:text-[var(--gt-ink-primary)]'}`}
                      onClick={() => !disabled && openEditModal(row)}
                    >
                      {stringifyEditValue(row.draftValue) || '—'}
                    </span>
                  ) : (
                    <AutoWidthInput
                      value={String(row.draftValue ?? '')}
                      disabled={disabled}
                      onChange={(val) => updateDraftValue(row.id, parseEditValue(val, row))}
                    />
                  )}
                </div>
              );
            }}
          />
        </div>
      </div>

      <Modal
        open={!!editingRow}
        title={editingRow?.key}
        onOk={handleEditSave}
        onCancel={() => setEditingRow(null)}
        okText={t('common.save')}
        cancelText={t('common.cancel')}
        destroyOnHidden
      >
        {editingRow?.valueType === 'textarea' || editingRow?.valueType === 'toml' || editingRow?.valueType === 'string_array' ? (
          <Input.TextArea
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            rows={6}
            className="font-mono"
          />
        ) : (
          <Input
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            className="font-mono"
          />
        )}
      </Modal>
    </div>
  );
}
