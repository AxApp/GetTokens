import { useMemo, useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { useI18n } from '../../../context/I18nContext';
import DesignSystemStoryFrame from '../../design-system/DesignSystemStoryFrame';
import {
  buildCodexBinaryRows,
  filterCodexBinaryRows,
  type CodexBinaryReleaseFilter,
  type CodexBinarySnapshot,
  type CodexBinaryVersionRowView,
} from '../model';
import { codexBinaryPreviewNotes, codexBinaryPreviewSnapshot } from '../previewData';
import CodexBinarySummaryPanel from './CodexBinarySummaryPanel';
import CodexBinaryVersionList from './CodexBinaryVersionList';

const meta = {
  title: 'Design System/业务组件/Codex 二进制',
  parameters: {
    layout: 'fullscreen',
  },
} satisfies Meta;

export default meta;
type Story = StoryObj;

const copy = {
  zh: {
    'codex_binary.no_active': '尚未启用托管版本',
    'codex_binary.managed_path_enabled': '已启用托管 PATH',
    'codex_binary.managed_path_disabled': '未启用托管 PATH',
    'codex_binary.enable_managed': '一键托管',
    'codex_binary.managing': '托管中',
    'codex_binary.refresh': '检查更新',
    'codex_binary.managed_bin_dir': '托管目录',
    'codex_binary.resolved_codex_path': 'PATH 解析',
    'codex_binary.resolved_codex_missing': '未在 PATH 中找到 codex',
    'codex_binary.managed_profile_target': '配置文件',
    'codex_binary.managed_profile_unknown': '待后端识别',
    'codex_binary.release_filter': '版本筛选',
    'codex_binary.filter_all': '全部',
    'codex_binary.filter_stable': '正式版',
    'codex_binary.filter_alpha': 'Alpha',
    'codex_binary.loading': '正在加载二进制状态',
    'codex_binary.empty': '当前没有托管版本',
    'codex_binary.empty_filtered': '当前筛选下没有版本',
    'codex_binary.active': '已启用',
    'codex_binary.rollback_available': '可回退',
    'codex_binary.file_size': '文件大小',
    'codex_binary.file_size_unknown': '未知',
    'codex_binary.download': '下载',
    'codex_binary.downloading': '下载中',
    'codex_binary.activate': '激活',
    'codex_binary.activating': '激活中',
    'codex_binary.rollback': '激活',
    'codex_binary.more_actions': '更多操作',
    'codex_binary.open_in_browser': '在浏览器中打开',
    'codex_binary.reveal_in_finder': '在 Finder 中打开',
    'codex_binary.delete_version': '删除版本',
    'codex_binary.notes_loading': '正在加载变更记录',
    'codex_binary.notes_empty': '这个版本没有提供变更说明',
    'codex_binary.notes_from_cache': '变更记录来自缓存',
    'codex_binary.notes_from_remote': '变更记录来自远端',
    'codex_binary.local_import_notes': '本地导入版本没有远端变更记录，详情以本机检测版本和 sha256 为准。',
    'codex_binary.phase_download': '下载中',
    'codex_binary.phase_downloading': '下载中',
    'codex_binary.phase_verifying': '校验中',
    'codex_binary.phase_extracting': '解包中',
    'codex_binary.phase_importing': '导入中',
    'codex_binary.phase_activating': '激活中',
    'codex_binary.phase_resolving_asset': '解析资源',
    'codex_binary.phase_failed': '下载失败',
  },
  en: {
    'codex_binary.no_active': 'No managed version active',
    'codex_binary.managed_path_enabled': 'Managed PATH enabled',
    'codex_binary.managed_path_disabled': 'Managed PATH disabled',
    'codex_binary.enable_managed': 'Enable managed',
    'codex_binary.managing': 'Managing',
    'codex_binary.refresh': 'Check updates',
    'codex_binary.managed_bin_dir': 'Managed dir',
    'codex_binary.resolved_codex_path': 'PATH resolves to',
    'codex_binary.resolved_codex_missing': 'codex not found in PATH',
    'codex_binary.managed_profile_target': 'Profile',
    'codex_binary.managed_profile_unknown': 'Unknown profile',
    'codex_binary.release_filter': 'Release filter',
    'codex_binary.filter_all': 'All',
    'codex_binary.filter_stable': 'Stable',
    'codex_binary.filter_alpha': 'Alpha',
    'codex_binary.loading': 'Loading binary state',
    'codex_binary.empty': 'No managed versions',
    'codex_binary.empty_filtered': 'No versions for this filter',
    'codex_binary.active': 'Active',
    'codex_binary.rollback_available': 'Rollback',
    'codex_binary.file_size': 'File size',
    'codex_binary.file_size_unknown': 'Unknown',
    'codex_binary.download': 'Download',
    'codex_binary.downloading': 'Downloading',
    'codex_binary.activate': 'Activate',
    'codex_binary.activating': 'Activating',
    'codex_binary.rollback': 'Activate',
    'codex_binary.more_actions': 'More actions',
    'codex_binary.open_in_browser': 'Open in browser',
    'codex_binary.reveal_in_finder': 'Reveal in Finder',
    'codex_binary.delete_version': 'Delete version',
    'codex_binary.notes_loading': 'Loading release notes',
    'codex_binary.notes_empty': 'No release notes for this version',
    'codex_binary.notes_from_cache': 'Release notes from cache',
    'codex_binary.notes_from_remote': 'Release notes from remote',
    'codex_binary.local_import_notes': 'Local imports do not have remote release notes.',
    'codex_binary.phase_download': 'Downloading',
    'codex_binary.phase_downloading': 'Downloading',
    'codex_binary.phase_verifying': 'Verifying',
    'codex_binary.phase_extracting': 'Extracting',
    'codex_binary.phase_importing': 'Importing',
    'codex_binary.phase_activating': 'Activating',
    'codex_binary.phase_resolving_asset': 'Resolving asset',
    'codex_binary.phase_failed': 'Download failed',
  },
} as const;

function useStoryCopy() {
  const { locale } = useI18n();
  const dictionary = locale === 'zh' ? copy.zh : copy.en;
  return {
    locale,
    t: (key: string) => dictionary[key as keyof typeof dictionary] || key,
  };
}

function buildErrorSnapshot(): CodexBinarySnapshot {
  return {
    ...codexBinaryPreviewSnapshot,
    managedConfig: codexBinaryPreviewSnapshot.managedConfig
      ? {
          ...codexBinaryPreviewSnapshot.managedConfig,
          isPathConfigured: true,
          resolvedCodexPath: codexBinaryPreviewSnapshot.managedConfig.binPath,
          isResolvedToManaged: true,
        }
      : undefined,
    doctor: {
      severity: 'error',
      message: 'PATH resolves to a deleted binary',
    },
  };
}

function buildRows(): CodexBinaryVersionRowView[] {
  return buildCodexBinaryRows(codexBinaryPreviewSnapshot).map((row, index) =>
    index === 0
      ? {
          ...row,
          primaryAction: 'download',
        }
      : row,
  );
}

function SummarySample({
  snapshot = codexBinaryPreviewSnapshot,
  message = 'Preview data only. No filesystem writes are performed.',
  loading = false,
  managedBusy = false,
}: {
  snapshot?: CodexBinarySnapshot;
  message?: string;
  loading?: boolean;
  managedBusy?: boolean;
}) {
  const { t } = useStoryCopy();
  return (
    <DesignSystemStoryFrame>
      <CodexBinarySummaryPanel
        snapshot={snapshot}
        message={message}
        loading={loading}
        managedBusy={managedBusy}
        onEnableManagedPath={() => undefined}
        onRefresh={() => undefined}
        t={t}
      />
    </DesignSystemStoryFrame>
  );
}

function VersionListSample({
  empty = false,
  expanded = true,
}: {
  empty?: boolean;
  expanded?: boolean;
}) {
  const { t } = useStoryCopy();
  const [releaseFilter, setReleaseFilter] = useState<CodexBinaryReleaseFilter>('stable');
  const [menuRowID, setMenuRowID] = useState('');
  const rows = useMemo(() => (empty ? [] : buildRows()), [empty]);
  const visibleRows = useMemo(() => filterCodexBinaryRows(rows, releaseFilter), [releaseFilter, rows]);
  const expandedRows = useMemo(
    () =>
      expanded && visibleRows[0]
        ? {
            [visibleRows[0].rowID]: true,
          }
        : {},
    [expanded, visibleRows],
  );

  return (
    <DesignSystemStoryFrame>
      <CodexBinaryVersionList
        rows={rows}
        visibleRows={visibleRows}
        loading={false}
        releaseFilter={releaseFilter}
        releaseFilterOptions={[
          { id: 'stable', label: t('codex_binary.filter_stable') },
          { id: 'alpha', label: t('codex_binary.filter_alpha') },
          { id: 'all', label: t('codex_binary.filter_all') },
        ]}
        expandedRows={expandedRows}
        notesByRow={
          visibleRows[0]
            ? {
                [visibleRows[0].rowID]: {
                  loading: false,
                  notes: codexBinaryPreviewNotes,
                },
              }
            : {}
        }
        busyVersionID=""
        busyRowID=""
        menuRowID={menuRowID}
        onReleaseFilterChange={setReleaseFilter}
        onToggleNotes={() => undefined}
        onActivate={() => undefined}
        onDownload={() => undefined}
        onToggleMenu={(rowID) => setMenuRowID((current) => (current === rowID ? '' : rowID))}
        onOpenBrowser={() => undefined}
        onReveal={() => undefined}
        onDelete={() => undefined}
        t={t}
      />
    </DesignSystemStoryFrame>
  );
}

function CodexBinaryOverview() {
  const { locale } = useStoryCopy();
  const zh = locale === 'zh';

  return (
    <div className="grid w-full gap-5 bg-[var(--gt-surface-panel)] p-6">
      <div>
        <h2 className="text-2xl font-black uppercase italic tracking-normal">Codex 二进制组件</h2>
        <p className="mt-2 max-w-3xl text-sm font-bold text-[var(--gt-ink-muted)]">
          {zh
            ? '把 Codex 二进制管理里的摘要面板、版本列表和可展开版本行纳入设计系统，统一检查托管 PATH、下载进度、筛选和 release notes。'
            : 'Admitted Codex binary summary, version list, and expandable version rows for managed PATH, download progress, filters, and release notes.'}
        </p>
      </div>

      <section className="grid gap-3 border-2 border-[var(--gt-border-strong)] bg-[var(--gt-surface-canvas)] p-4">
        <h3 className="text-sm font-black uppercase italic tracking-normal">{zh ? '摘要面板' : 'Summary panels'}</h3>
        <SummarySample />
        <SummarySample snapshot={buildErrorSnapshot()} message={zh ? 'PATH 已托管，但 doctor 返回错误。' : 'Managed PATH is enabled while doctor reports an error.'} />
      </section>

      <section className="grid gap-3 border-2 border-[var(--gt-border-strong)] bg-[var(--gt-surface-canvas)] p-4">
        <h3 className="text-sm font-black uppercase italic tracking-normal">{zh ? '版本列表' : 'Version list'}</h3>
        <VersionListSample />
        <VersionListSample empty />
      </section>
    </div>
  );
}

export const Overview: Story = {
  render: () => <CodexBinaryOverview />,
};

export const Summary: Story = {
  render: () => <SummarySample />,
};

export const SummaryError: Story = {
  render: () => <SummarySample snapshot={buildErrorSnapshot()} />,
};

export const VersionList: Story = {
  render: () => <VersionListSample />,
};

export const EmptyVersionList: Story = {
  render: () => <VersionListSample empty />,
};
