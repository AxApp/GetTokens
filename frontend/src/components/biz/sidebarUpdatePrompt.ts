import type { ReleaseInfo } from '../../types';

export type SidebarUpdateAction = 'apply' | 'open-release-page' | 'native';

export interface SidebarUpdatePrompt {
  action: SidebarUpdateAction;
  releaseVersion: string;
}

export function resolveSidebarUpdatePrompt({
  availableRelease,
  canApplyUpdate,
  usesNativeUpdaterUI,
}: {
  availableRelease: ReleaseInfo | null;
  canApplyUpdate: boolean;
  usesNativeUpdaterUI: boolean;
}): SidebarUpdatePrompt | null {
  const releaseVersion = availableRelease?.version?.trim() ?? '';
  if (!availableRelease || !releaseVersion) {
    return null;
  }

  if (usesNativeUpdaterUI) {
    return {
      action: 'native',
      releaseVersion,
    };
  }

  return {
    action: canApplyUpdate ? 'apply' : 'open-release-page',
    releaseVersion,
  };
}
