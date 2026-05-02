import {
  normalizeCodexFeatureConfigSnapshot,
  normalizeCodexFeaturePreview,
  type CodexFeatureChangeInput,
  type CodexFeatureConfigSnapshot,
  type CodexFeaturePreview,
} from '../model/codexFeatureConfig';

interface CodexFeatureRuntimeApp {
  GetCodexFeatureConfig?: () => Promise<unknown>;
  PreviewCodexFeatureConfig?: (input: CodexFeatureChangeInput) => Promise<unknown>;
  SaveCodexFeatureConfig?: (input: CodexFeatureChangeInput) => Promise<unknown>;
}

function resolveRuntimeMethod<T extends keyof CodexFeatureRuntimeApp>(methodName: T) {
  const runtimeWindow = globalThis.window as unknown as {
    go?: {
      main?: {
        App?: CodexFeatureRuntimeApp;
      };
    };
  };
  const app = runtimeWindow?.go?.main?.App;
  const method = app?.[methodName];

  if (typeof method !== 'function') {
    throw new Error(`当前运行时缺少 ${methodName} 绑定。`);
  }

  return method.bind(app) as NonNullable<CodexFeatureRuntimeApp[T]>;
}

export async function getCodexFeatureConfig(): Promise<CodexFeatureConfigSnapshot> {
  const getConfig = resolveRuntimeMethod('GetCodexFeatureConfig');
  return normalizeCodexFeatureConfigSnapshot(await getConfig());
}

export async function previewCodexFeatureConfig(
  input: CodexFeatureChangeInput,
  configPath = ''
): Promise<CodexFeaturePreview> {
  const previewConfig = resolveRuntimeMethod('PreviewCodexFeatureConfig');
  return normalizeCodexFeaturePreview(await previewConfig(input), input, configPath);
}

export async function saveCodexFeatureConfig(input: CodexFeatureChangeInput): Promise<void> {
  const saveConfig = resolveRuntimeMethod('SaveCodexFeatureConfig');
  await saveConfig(input);
}
