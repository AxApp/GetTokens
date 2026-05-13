import { hasPreviewMode, hasWailsAppBindings } from '../../utils/previewMode';
import type { CodexBinaryEnableManagedPathResult, CodexBinarySnapshot, CodexBinaryVersionNotes } from './model';
import { codexBinaryPreviewNotes, codexBinaryPreviewSnapshot } from './previewData';

type WailsCodexBinaryBridge = {
  GetCodexBinarySnapshot?: () => Promise<CodexBinarySnapshot>;
  RefreshCodexBinaryAvailable?: () => Promise<CodexBinarySnapshot>;
  GetCodexBinaryVersionNotes?: (input: { sourceID: string; tag: string }) => Promise<CodexBinaryVersionNotes>;
  DownloadCodexBinary?: (input: { sourceID: string; tag: string; activateAfterInstall: boolean }) => Promise<{ snapshot?: CodexBinarySnapshot }>;
  EnableCodexBinaryManagedPath?: () => Promise<CodexBinaryEnableManagedPathResult>;
  UseCodexBinary?: (input: { versionID: string; expectedCurrentVersionID?: string }) => Promise<{ snapshot?: CodexBinarySnapshot }>;
  RevealCodexBinaryVersion?: (input: { versionID: string }) => Promise<void>;
  DeleteCodexBinaryVersion?: (input: { versionID: string }) => Promise<{ snapshot?: CodexBinarySnapshot }>;
};

function getBridge(): WailsCodexBinaryBridge | null {
  if (!hasWailsAppBindings()) {
    return null;
  }
  const app = (window as Window & { go?: { main?: { App?: WailsCodexBinaryBridge } } }).go?.main?.App;
  return app || null;
}

export async function getCodexBinarySnapshot(): Promise<CodexBinarySnapshot> {
  if (hasPreviewMode('codex-binary')) {
    return codexBinaryPreviewSnapshot;
  }
  const bridge = getBridge();
  if (!bridge?.GetCodexBinarySnapshot) {
    return codexBinaryPreviewSnapshot;
  }
  return bridge.GetCodexBinarySnapshot();
}

export async function refreshCodexBinaryAvailable(): Promise<CodexBinarySnapshot> {
  if (hasPreviewMode('codex-binary')) {
    return codexBinaryPreviewSnapshot;
  }
  const bridge = getBridge();
  if (!bridge?.RefreshCodexBinaryAvailable) {
    return codexBinaryPreviewSnapshot;
  }
  return bridge.RefreshCodexBinaryAvailable();
}

export async function getCodexBinaryVersionNotes(sourceID: string, tag: string): Promise<CodexBinaryVersionNotes> {
  if (hasPreviewMode('codex-binary')) {
    return { ...codexBinaryPreviewNotes, sourceID, tag };
  }
  const bridge = getBridge();
  if (!bridge?.GetCodexBinaryVersionNotes) {
    return { ...codexBinaryPreviewNotes, sourceID, tag };
  }
  return bridge.GetCodexBinaryVersionNotes({ sourceID, tag });
}

export async function useCodexBinary(versionID: string, expectedCurrentVersionID?: string): Promise<CodexBinarySnapshot> {
  const bridge = getBridge();
  if (!bridge?.UseCodexBinary || hasPreviewMode('codex-binary')) {
    return {
      ...codexBinaryPreviewSnapshot,
      selectedVersionID: versionID,
      versions: codexBinaryPreviewSnapshot.versions.map((version) => ({
        ...version,
        isSelected: version.id === versionID,
      })),
    };
  }
  const result = await bridge.UseCodexBinary({ versionID, expectedCurrentVersionID });
  return result.snapshot || getCodexBinarySnapshot();
}

export async function downloadCodexBinary(sourceID: string, tag: string, activateAfterInstall = false): Promise<CodexBinarySnapshot> {
  const bridge = getBridge();
  if (!bridge?.DownloadCodexBinary || hasPreviewMode('codex-binary')) {
    return {
      ...codexBinaryPreviewSnapshot,
      remoteVersions: codexBinaryPreviewSnapshot.remoteVersions?.map((version) => ({
        ...version,
        isInstalled: version.tag === tag ? true : version.isInstalled,
      })),
    };
  }
  const result = await bridge.DownloadCodexBinary({ sourceID, tag, activateAfterInstall });
  return result.snapshot || getCodexBinarySnapshot();
}

export async function revealCodexBinaryVersion(versionID: string): Promise<void> {
  const bridge = getBridge();
  if (!bridge?.RevealCodexBinaryVersion || hasPreviewMode('codex-binary')) {
    return;
  }
  await bridge.RevealCodexBinaryVersion({ versionID });
}

export async function deleteCodexBinaryVersion(versionID: string): Promise<CodexBinarySnapshot> {
  const bridge = getBridge();
  if (!bridge?.DeleteCodexBinaryVersion || hasPreviewMode('codex-binary')) {
    return {
      ...codexBinaryPreviewSnapshot,
      versions: codexBinaryPreviewSnapshot.versions.filter((version) => version.id !== versionID),
    };
  }
  const result = await bridge.DeleteCodexBinaryVersion({ versionID });
  return result.snapshot || getCodexBinarySnapshot();
}

export async function enableCodexBinaryManagedPath(): Promise<CodexBinaryEnableManagedPathResult> {
  const bridge = getBridge();
  if (!bridge?.EnableCodexBinaryManagedPath || hasPreviewMode('codex-binary')) {
    return {
      profilePath: codexBinaryPreviewSnapshot.managedConfig?.profilePath || '~/.profile',
      changed: true,
      messages: ['托管 PATH 写入后只对新开的终端生效'],
      snapshot: {
        ...codexBinaryPreviewSnapshot,
        managedConfig: codexBinaryPreviewSnapshot.managedConfig
          ? {
              ...codexBinaryPreviewSnapshot.managedConfig,
              isPathConfigured: true,
              isResolvedToManaged: true,
              resolvedCodexPath: codexBinaryPreviewSnapshot.managedConfig.binPath,
            }
          : undefined,
        doctor: { severity: 'ok', message: '托管版本可用' },
      },
    };
  }
  return bridge.EnableCodexBinaryManagedPath();
}
