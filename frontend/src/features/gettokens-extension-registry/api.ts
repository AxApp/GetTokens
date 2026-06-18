import {
  ApplyGetTokensExtensionCodexConfigTransaction,
  GetGetTokensExtensionRegistrySnapshot,
  PrepareGetTokensExtensionCodexConfigApply,
  PreviewGetTokensExtensionCodexConfigDryRun,
  SetGetTokensExtensionEnabled,
} from '../../../wailsjs/go/main/App';
import type { main } from '../../../wailsjs/go/models';
import { hasWailsAppBindings } from '../../utils/previewMode';
import {
  getGetTokensExtensionCodexConfigDryRunPreview,
  getGetTokensExtensionRegistryPreviewSnapshot,
} from './previewData';

export async function loadGetTokensExtensionRegistrySnapshot(
  input?: main.GetTokensExtensionRegistrySnapshotInput,
): Promise<main.GetTokensExtensionRegistrySnapshot> {
  if (!hasWailsAppBindings()) {
    return getGetTokensExtensionRegistryPreviewSnapshot();
  }
  return GetGetTokensExtensionRegistrySnapshot(
    input || ({} as main.GetTokensExtensionRegistrySnapshotInput),
  ) as Promise<main.GetTokensExtensionRegistrySnapshot>;
}

export async function setGetTokensExtensionEnabled(
  input: main.SetGetTokensExtensionEnabledInput,
): Promise<main.GetTokensExtensionEnableStateFile> {
  if (!hasWailsAppBindings()) {
    return {
      contractVersion: '0.1.0',
      updatedAt: new Date('2026-06-17T08:40:00Z').toISOString().replace('.000Z', 'Z'),
      extensions: [
        {
          id: input.extensionID,
          state: input.enabled ? 'enabled' : 'disabled',
          reason: 'preview-local-state-mutation',
        },
      ],
    } as main.GetTokensExtensionEnableStateFile;
  }
  return SetGetTokensExtensionEnabled(input) as Promise<main.GetTokensExtensionEnableStateFile>;
}

export async function previewGetTokensExtensionCodexConfigDryRun(
  input?: main.PreviewGetTokensExtensionCodexConfigDryRunInput,
): Promise<main.GetTokensExtensionCodexConfigDryRunPreview> {
  if (!hasWailsAppBindings()) {
    return getGetTokensExtensionCodexConfigDryRunPreview();
  }
  return PreviewGetTokensExtensionCodexConfigDryRun(
    input || ({} as main.PreviewGetTokensExtensionCodexConfigDryRunInput),
  ) as Promise<main.GetTokensExtensionCodexConfigDryRunPreview>;
}

export async function prepareGetTokensExtensionCodexConfigApply(
  input: main.PrepareGetTokensExtensionCodexConfigApplyInput,
): Promise<main.GetTokensExtensionCodexConfigStagedApplyPlan> {
  if (!hasWailsAppBindings()) {
    throw new Error('Wails runtime is required before staged Codex config apply can be prepared.');
  }
  return PrepareGetTokensExtensionCodexConfigApply(input) as Promise<main.GetTokensExtensionCodexConfigStagedApplyPlan>;
}

export async function applyGetTokensExtensionCodexConfigTransaction(
  input: main.ApplyGetTokensExtensionCodexConfigTransactionInput,
): Promise<main.GetTokensExtensionCodexConfigStagedApplyResult> {
  if (!hasWailsAppBindings()) {
    throw new Error('Wails runtime is required before staged Codex config apply can run.');
  }
  return ApplyGetTokensExtensionCodexConfigTransaction(input) as Promise<main.GetTokensExtensionCodexConfigStagedApplyResult>;
}
