export type CodexBinaryTaskStatus =
  | 'queued'
  | 'resolving_asset'
  | 'downloading'
  | 'verifying'
  | 'extracting'
  | 'importing'
  | 'activating'
  | 'completed'
  | 'canceling'
  | 'canceled'
  | 'interrupted'
  | 'failed';

export interface CodexBinaryVersionView {
  id: string;
  displayName: string;
  detectedVersion: string;
  releaseTag?: string;
  sourceID: string;
  sourceType: string;
  sourceURL?: string;
  installedAt: string;
  lastActivatedAt?: string;
  isSelected: boolean;
  existsOnDisk: boolean;
  binaryRelativePath?: string;
  binaryPath?: string;
}

export interface CodexBinaryRemoteVersionView {
  sourceID: string;
  version: string;
  tag: string;
  title: string;
  downloadURL: string;
  htmlURL?: string;
  assetName?: string;
  assetSize?: number;
  publishedAt?: string;
  isPrerelease: boolean;
  isInstalled: boolean;
}

export interface CodexBinaryDownloadTaskView {
  id: string;
  sourceID: string;
  tag: string;
  version: string;
  status: CodexBinaryTaskStatus;
  phase: string;
  bytesDone: number;
  bytesTotal: number;
  installAfterDownload: boolean;
  activateAfterInstall: boolean;
  errorCode?: string;
  errorMessage?: string;
  updatedAt: string;
}

export interface CodexBinaryVersionRowView {
  rowID: string;
  version: string;
  tag?: string;
  sourceID: string;
  installedVersionID?: string;
  isInstalled: boolean;
  isSelected: boolean;
  isRollback: boolean;
  hasRemote: boolean;
  publishedAt?: string;
  installedAt?: string;
  isPrerelease?: boolean;
  notesState: string;
  task?: CodexBinaryDownloadTaskView;
  primaryAction: CodexBinaryPrimaryAction;
  secondaryAction?: CodexBinarySecondaryAction;
}

export type CodexBinaryReleaseFilter = 'all' | 'stable' | 'alpha';

export type CodexBinaryPrimaryAction =
  | 'download_activate'
  | 'download'
  | 'activate'
  | 'rollback'
  | 'none';

export type CodexBinarySecondaryAction = 'cancel' | 'reveal' | 'retry';

export interface CodexBinaryDoctorSummary {
  severity: 'ok' | 'info' | 'warning' | 'error' | string;
  message: string;
}

export interface CodexBinaryManagedConfig {
  binDir: string;
  binPath: string;
  enableCommand: string;
  profilePath?: string;
  profileKind?: string;
  isPathConfigured: boolean;
  resolvedCodexPath?: string;
  isResolvedToManaged: boolean;
}

export interface CodexBinarySnapshot {
  manifestPath: string;
  managedBinPath: string;
  managedConfig?: CodexBinaryManagedConfig;
  selectedVersionID?: string;
  currentVersion?: CodexBinaryVersionView;
  versions: CodexBinaryVersionView[];
  remoteVersions?: CodexBinaryRemoteVersionView[];
  versionRows?: CodexBinaryVersionRowView[];
  downloadTasks?: CodexBinaryDownloadTaskView[];
  doctor: CodexBinaryDoctorSummary;
}

export interface CodexBinaryEnableManagedPathResult {
  profilePath: string;
  backupPath?: string;
  changed: boolean;
  messages: string[];
  snapshot?: CodexBinarySnapshot;
}

export interface CodexBinaryVersionNotes {
  sourceID: string;
  tag: string;
  version: string;
  title: string;
  htmlURL?: string;
  publishedAt?: string;
  bodyMarkdown: string;
  bodyPlainText?: string;
  source: 'remote' | 'cache' | 'local' | string;
  truncated: boolean;
}

const activeTaskStatuses = new Set<CodexBinaryTaskStatus>([
  'queued',
  'resolving_asset',
  'downloading',
  'verifying',
  'extracting',
  'importing',
  'activating',
  'canceling',
]);

export function isActiveDownloadTask(task: CodexBinaryDownloadTaskView | undefined): boolean {
  return Boolean(task && activeTaskStatuses.has(task.status));
}

export function buildCodexBinaryRows(snapshot: CodexBinarySnapshot): CodexBinaryVersionRowView[] {
  if (snapshot.versionRows && snapshot.versionRows.length > 0) {
    return snapshot.versionRows;
  }

  const rowsByKey = new Map<string, CodexBinaryVersionRowView>();
  const tasksByTag = new Map((snapshot.downloadTasks || []).map((task) => [task.tag, task]));

  for (const version of snapshot.versions || []) {
    const key = version.releaseTag || `local:${version.id}`;
    rowsByKey.set(key, {
      rowID: `installed:${version.id}`,
      version: version.detectedVersion,
      tag: version.releaseTag,
      sourceID: version.sourceID,
      installedVersionID: version.id,
      isInstalled: true,
      isSelected: version.isSelected,
      isRollback: Boolean(snapshot.selectedVersionID && !version.isSelected),
      hasRemote: false,
      installedAt: version.installedAt,
      isPrerelease: isPrereleaseVersion(version.detectedVersion, version.releaseTag),
      notesState: version.releaseTag ? 'none' : 'local',
      primaryAction: version.isSelected ? 'none' : snapshot.selectedVersionID ? 'rollback' : 'activate',
      secondaryAction: 'reveal',
    });
  }

  for (const remote of snapshot.remoteVersions || []) {
    const existing = rowsByKey.get(remote.tag);
    const task = tasksByTag.get(remote.tag);
    if (existing) {
      existing.hasRemote = true;
      existing.publishedAt = remote.publishedAt;
      existing.task = task;
      existing.isPrerelease = remote.isPrerelease || isPrereleaseVersion(remote.version, remote.tag);
      continue;
    }
    rowsByKey.set(remote.tag, {
      rowID: `remote:${remote.tag}`,
      version: remote.version,
      tag: remote.tag,
      sourceID: remote.sourceID,
      isInstalled: false,
      isSelected: false,
      isRollback: false,
      hasRemote: true,
      publishedAt: remote.publishedAt,
      isPrerelease: remote.isPrerelease || isPrereleaseVersion(remote.version, remote.tag),
      notesState: 'none',
      task,
      primaryAction: task && isActiveDownloadTask(task) ? 'none' : 'download_activate',
      secondaryAction: task && isActiveDownloadTask(task) ? 'cancel' : undefined,
    });
  }

  return [...rowsByKey.values()].sort(compareRows);
}

export function filterCodexBinaryRows(
  rows: CodexBinaryVersionRowView[],
  filter: CodexBinaryReleaseFilter,
): CodexBinaryVersionRowView[] {
  if (filter === 'all') {
    return rows;
  }
  return rows.filter((row) => {
    const prerelease = row.isPrerelease ?? isPrereleaseVersion(row.version, row.tag);
    return filter === 'alpha' ? prerelease : !prerelease;
  });
}

export function getCodexBinaryRowActions(row: CodexBinaryVersionRowView) {
  if (row.task && isActiveDownloadTask(row.task)) {
    return { primary: 'none' as CodexBinaryPrimaryAction, secondary: 'cancel' as CodexBinarySecondaryAction };
  }
  if (row.task?.status === 'failed') {
    return { primary: 'download_activate' as CodexBinaryPrimaryAction, secondary: 'retry' as CodexBinarySecondaryAction };
  }
  if (row.isSelected) {
    return { primary: 'none' as CodexBinaryPrimaryAction, secondary: 'reveal' as CodexBinarySecondaryAction };
  }
  if (row.isInstalled) {
    return {
      primary: row.isRollback ? 'rollback' as CodexBinaryPrimaryAction : 'activate' as CodexBinaryPrimaryAction,
      secondary: 'reveal' as CodexBinarySecondaryAction,
    };
  }
  return { primary: row.primaryAction || 'download_activate', secondary: row.secondaryAction };
}

export function formatTaskProgress(task: CodexBinaryDownloadTaskView | undefined): number {
  if (!task || task.bytesTotal <= 0) {
    return 0;
  }
  return Math.max(0, Math.min(100, Math.round((task.bytesDone / task.bytesTotal) * 100)));
}

function compareRows(left: CodexBinaryVersionRowView, right: CodexBinaryVersionRowView): number {
  const leftParts = parseVersion(left.version);
  const rightParts = parseVersion(right.version);
  for (let index = 0; index < 3; index += 1) {
    const delta = rightParts[index] - leftParts[index];
    if (delta !== 0) {
      return delta;
    }
  }
  return (right.publishedAt || right.installedAt || '').localeCompare(left.publishedAt || left.installedAt || '');
}

function parseVersion(value: string): [number, number, number] {
  const match = value.match(/(\d+)\.(\d+)\.(\d+)/);
  if (!match) {
    return [0, 0, 0];
  }
  return [Number(match[1] || 0), Number(match[2] || 0), Number(match[3] || 0)];
}

function isPrereleaseVersion(version: string, tag?: string): boolean {
  const value = `${version} ${tag || ''}`.toLowerCase();
  return /(?:^|[.\-_\s])(alpha|beta|rc|pre|preview)(?:[.\-_\s]|\d|$)/.test(value);
}
