import {
  normalizeCodexFeatureConfigSnapshot,
  normalizeCodexFeaturePreview,
  type CodexFeatureChangeInput,
  type CodexFeatureConfigSnapshot,
  type CodexFeaturePreview,
} from '../model/codexFeatureConfig.ts';

interface CodexFeatureRuntimeApp {
  GetCodexFeatureConfig?: () => Promise<unknown>;
  PreviewCodexFeatureConfig?: (input: CodexFeatureChangeInput) => Promise<unknown>;
  SaveCodexFeatureConfig?: (input: CodexFeatureChangeInput) => Promise<unknown>;
}

const previewCodexConfigItems = [
  {
    id: 'root.profile',
    section: 'root',
    key: 'profile',
    path: ['profile'],
    valueType: 'string',
    defaultValue: 'default',
    localValue: 'gettokens-preview',
    description: 'Active Codex profile for local preview sessions.',
  },
  {
    id: 'root.model',
    section: 'root',
    key: 'model',
    path: ['model'],
    valueType: 'string',
    defaultValue: 'gpt-5',
    localValue: 'gpt-5.4',
    description: 'Default model used when new Codex sessions start.',
  },
  {
    id: 'root.approval_policy',
    section: 'root',
    key: 'approval_policy',
    path: ['approval_policy'],
    valueType: 'enum',
    options: ['untrusted', 'on-failure', 'on-request', 'never'],
    defaultValue: 'on-request',
    localValue: 'on-request',
    description: 'Approval policy for commands that need elevated confirmation.',
  },
  {
    id: 'root.sandbox_mode',
    section: 'root',
    key: 'sandbox_mode',
    path: ['sandbox_mode'],
    valueType: 'enum',
    options: ['read-only', 'workspace-write', 'danger-full-access'],
    defaultValue: 'workspace-write',
    localValue: 'workspace-write',
    description: 'Filesystem sandbox used by local Codex sessions.',
  },
  {
    id: 'root.hide_agent_reasoning',
    section: 'root',
    key: 'hide_agent_reasoning',
    path: ['hide_agent_reasoning'],
    valueType: 'boolean',
    defaultValue: true,
    localValue: false,
    description: 'Show or hide agent reasoning panels in compatible clients.',
  },
  {
    id: 'model_providers.gettokens.name',
    section: 'model_providers',
    key: 'name',
    path: ['model_providers', 'gettokens', 'name'],
    valueType: 'string',
    defaultValue: 'GetTokens Relay',
    localValue: 'GetTokens Relay',
    description: 'Display name for the GetTokens relay provider.',
  },
  {
    id: 'model_providers.gettokens.base_url',
    section: 'model_providers',
    key: 'base_url',
    path: ['model_providers', 'gettokens', 'base_url'],
    valueType: 'string',
    defaultValue: 'http://127.0.0.1:18317/v1',
    localValue: 'http://127.0.0.1:18317/v1',
    description: 'OpenAI-compatible base URL exposed by the local sidecar.',
  },
  {
    id: 'model_providers.gettokens.wire_api',
    section: 'model_providers',
    key: 'wire_api',
    path: ['model_providers', 'gettokens', 'wire_api'],
    valueType: 'enum',
    options: ['chat', 'responses'],
    defaultValue: 'responses',
    localValue: 'responses',
    description: 'Wire protocol used for Codex requests.',
  },
  {
    id: 'model_providers.openrouter.base_url',
    section: 'model_providers',
    key: 'base_url',
    path: ['model_providers', 'openrouter', 'base_url'],
    valueType: 'string',
    defaultValue: 'https://openrouter.ai/api/v1',
    localValue: 'https://openrouter.ai/api/v1',
    description: 'Example external provider for comparing model routing.',
  },
  {
    id: 'tool_search',
    section: 'features',
    key: 'tool_search',
    path: ['features', 'tool_search'],
    stage: 'stable',
    valueType: 'boolean',
    defaultValue: true,
    localValue: true,
    description: 'Enable tool discovery and deferred MCP tool search.',
  },
  {
    id: 'features.multi_agent_v2.enabled',
    section: 'features',
    key: 'multi_agent_v2.enabled',
    path: ['features', 'multi_agent_v2', 'enabled'],
    stage: 'advanced',
    valueType: 'boolean',
    defaultValue: false,
    localValue: true,
    description: 'Enable Multi-Agent V2 tools.',
  },
  {
    id: 'features.multi_agent_v2.max_concurrent_threads_per_session',
    section: 'features',
    key: 'multi_agent_v2.max_concurrent_threads_per_session',
    path: ['features', 'multi_agent_v2', 'max_concurrent_threads_per_session'],
    stage: 'advanced',
    valueType: 'integer',
    defaultValue: 4,
    localValue: 4,
    description: 'Maximum concurrent Multi-Agent V2 threads per session.',
  },
  {
    id: 'features.multi_agent_v2.default_wait_timeout_ms',
    section: 'features',
    key: 'multi_agent_v2.default_wait_timeout_ms',
    path: ['features', 'multi_agent_v2', 'default_wait_timeout_ms'],
    stage: 'advanced',
    valueType: 'integer',
    defaultValue: 30000,
    localValue: 30000,
    description: 'Default wait timeout for Multi-Agent V2 wait operations.',
  },
  {
    id: 'features.multi_agent_v2.usage_hint_enabled',
    section: 'features',
    key: 'multi_agent_v2.usage_hint_enabled',
    path: ['features', 'multi_agent_v2', 'usage_hint_enabled'],
    stage: 'advanced',
    valueType: 'boolean',
    defaultValue: true,
    localValue: true,
    description: 'Include Multi-Agent V2 usage hints in tool instructions.',
  },
  {
    id: 'features.multi_agent_v2.usage_hint_text',
    section: 'features',
    key: 'multi_agent_v2.usage_hint_text',
    path: ['features', 'multi_agent_v2', 'usage_hint_text'],
    stage: 'advanced',
    valueType: 'textarea',
    defaultValue: undefined,
    description: 'Custom usage hint text for Multi-Agent V2 tools.',
  },
  {
    id: 'apply_patch_streaming_events',
    section: 'features',
    key: 'apply_patch_streaming_events',
    path: ['features', 'apply_patch_streaming_events'],
    stage: 'experimental',
    valueType: 'boolean',
    defaultValue: false,
    localValue: true,
    description: 'Stream apply_patch progress events during file edits.',
  },
  {
    id: 'web_search_request',
    section: 'features',
    key: 'web_search_request',
    path: ['features', 'web_search_request'],
    stage: 'deprecated',
    valueType: 'boolean',
    defaultValue: false,
    localValue: false,
    description: 'Legacy web search flag kept for compatibility checks.',
  },
  {
    id: 'notice.hide_full_access_warning',
    section: 'notice',
    key: 'hide_full_access_warning',
    path: ['notice', 'hide_full_access_warning'],
    valueType: 'boolean',
    defaultValue: false,
    localValue: false,
    description: 'Suppress the full-access warning notice.',
  },
  {
    id: 'notice.model_migrations',
    section: 'notice',
    key: 'model_migrations',
    path: ['notice', 'model_migrations'],
    valueType: 'toml',
    defaultValue: {},
    localRawValue: '[model_migrations]\n"gpt-5" = "gpt-5.4"',
    description: 'Structured model migration notice data.',
  },
];

let previewCodexConfigOverrides: Record<string, unknown> = {};

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
  const getConfig = resolveRuntimeMethodOrFallback('GetCodexFeatureConfig');
  if (!getConfig) {
    return normalizeCodexFeatureConfigSnapshot(buildPreviewCodexFeatureConfigRaw());
  }
  return normalizeCodexFeatureConfigSnapshot(await getConfig());
}

export async function previewCodexFeatureConfig(
  input: CodexFeatureChangeInput,
  configPath = ''
): Promise<CodexFeaturePreview> {
  const previewConfig = resolveRuntimeMethodOrFallback('PreviewCodexFeatureConfig');
  if (!previewConfig) {
    return normalizeCodexFeaturePreview(
      {
        summary: `${input.changes.length} preview change${input.changes.length === 1 ? '' : 's'}`,
        changes: input.changes.map((change) => ({
          ...change,
          before: resolvePreviewCodexConfigValue(change.id, change.key),
          after: change.remove ? undefined : change.value,
          kind: change.remove ? 'removed' : 'modified',
        })),
      },
      input,
      configPath || previewCodexConfigPath(),
    );
  }
  return normalizeCodexFeaturePreview(await previewConfig(input), input, configPath);
}

export async function saveCodexFeatureConfig(input: CodexFeatureChangeInput): Promise<void> {
  const saveConfig = resolveRuntimeMethodOrFallback('SaveCodexFeatureConfig');
  if (!saveConfig) {
    const nextOverrides = { ...previewCodexConfigOverrides };
    for (const change of input.changes) {
      const overrideKey = change.id || change.key;
      if (change.remove) {
        delete nextOverrides[overrideKey];
      } else {
        nextOverrides[overrideKey] = change.value;
      }
    }
    previewCodexConfigOverrides = nextOverrides;
    return;
  }
  await saveConfig(input);
}

function resolveRuntimeMethodOrFallback<T extends keyof CodexFeatureRuntimeApp>(
  methodName: T,
): NonNullable<CodexFeatureRuntimeApp[T]> | null {
  try {
    return resolveRuntimeMethod(methodName);
  } catch (error) {
    if (canUsePreviewCodexConfigData()) {
      return null;
    }
    throw error;
  }
}

function canUsePreviewCodexConfigData() {
  if (typeof window === 'undefined') {
    return true;
  }
  const location = window.location;
  return location.protocol === 'http:' || location.protocol === 'https:';
}

function previewCodexConfigPath() {
  return '/Users/preview/.codex/config.toml';
}

function buildPreviewCodexFeatureConfigRaw() {
  const items = previewCodexConfigItems.map((item) => {
    const override = previewCodexConfigOverrides[item.id] ?? previewCodexConfigOverrides[item.key];
    if (typeof override === 'undefined') {
      return item;
    }
    return {
      ...item,
      localValue: override,
      localRawValue: typeof override === 'object' ? JSON.stringify(override) : String(override),
      hasLocalValue: true,
    };
  });

  return {
    codexHomePath: '/Users/preview/.codex',
    configPath: previewCodexConfigPath(),
    loadedAt: new Date().toISOString(),
    warnings: ['browser preview data: no local Codex files were read or written'],
    features: items,
  };
}

function resolvePreviewCodexConfigValue(id: string, key: string) {
  const item = previewCodexConfigItems.find((candidate) => candidate.id === id || candidate.key === key);
  if (!item) {
    return undefined;
  }
  return previewCodexConfigOverrides[item.id] ?? previewCodexConfigOverrides[item.key] ?? item.localValue ?? item.defaultValue;
}
