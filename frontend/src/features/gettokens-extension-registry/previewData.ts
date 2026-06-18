import type { main } from '../../../wailsjs/go/models';

export function getGetTokensExtensionRegistryPreviewSnapshot(): main.GetTokensExtensionRegistrySnapshot {
  return {
    contractVersion: '0.1.0',
    registryMode: 'read-only',
    generatedAt: '2026-06-17T08:40:00Z',
    readOnly: true,
    roots: [
      {
        id: 'app-owned',
        path: '/Users/linhey/.config/gettokens-dev/extensions',
        readOnly: true,
      },
      {
        id: 'bundled',
        path: '/Applications/GetTokens Dev.app/Contents/Resources/extensions',
        readOnly: true,
      },
    ],
    extensions: [
      {
        id: 'com.example.openai-metadata',
        name: 'Example OpenAI Metadata',
        version: '0.1.0',
        publisher: {
          name: 'Example Labs',
          url: 'https://example.com',
        },
        source: {
          type: 'local',
          uri: 'file:///Users/linhey/.config/gettokens-dev/extensions/openai-metadata',
          revision: 'local',
          manifestPath: '/Users/linhey/.config/gettokens-dev/extensions/openai-metadata/gettokens.extension.json',
        },
        state: 'readonly-compatible',
        readOnly: true,
        compatibility: {
          manifestContract: '0.1.0',
          sidecarContract: '^0.1.0',
          capabilityContract: '^0.1.0',
          status: 'compatible',
        },
        permissions: ['provider.metadata.read', 'model.catalog.read'],
        capabilities: [
          {
            id: 'provider-openai',
            kind: 'provider-metadata',
            state: 'readonly-compatible',
            requiredPermissions: ['provider.metadata.read'],
            declaredContributions: ['provider:openai'],
            diagnostics: [],
          },
          {
            id: 'catalog-openai',
            kind: 'model-catalog-source',
            state: 'readonly-compatible',
            requiredPermissions: ['model.catalog.read'],
            declaredContributions: ['provider:openai/model:gpt-4.1'],
            diagnostics: [],
          },
        ],
        diagnostics: [],
      },
      {
        id: 'com.example.legacy-hook',
        name: 'Legacy Hook Probe',
        version: '0.0.2',
        publisher: {
          name: 'Example Labs',
        },
        source: {
          type: 'local',
          uri: 'file:///Users/linhey/.config/gettokens-dev/extensions/legacy-hook',
          revision: 'local',
          manifestPath: '/Users/linhey/.config/gettokens-dev/extensions/legacy-hook/gettokens.extension.json',
        },
        state: 'invalid',
        readOnly: true,
        compatibility: {
          manifestContract: '0.1.0',
          sidecarContract: '^0.1.0',
          capabilityContract: '^0.1.0',
          status: 'compatible',
        },
        permissions: ['provider.metadata.read', 'network.fetch.declared-endpoints'],
        capabilities: [
          {
            id: 'legacy-hook',
            kind: 'quota-probe',
            state: 'invalid',
            requiredPermissions: ['quota.probe.read'],
            declaredContributions: ['provider:legacy/quota'],
            diagnostics: [
              {
                code: 'forbidden-permission',
                severity: 'error',
                path: '$.permissions[1]',
                message: 'runtime.request.hook is not allowed by extension contract v0',
                source: '/Users/linhey/.config/gettokens-dev/extensions/legacy-hook/gettokens.extension.json',
              },
            ],
          },
        ],
        diagnostics: [
          {
            code: 'unknown-capability-kind',
            severity: 'error',
            path: '$.capabilities[0].kind',
            message: 'capability kind \"js-hook\" is not allowed by extension contract v0',
            source: '/Users/linhey/.config/gettokens-dev/extensions/legacy-hook/gettokens.extension.json',
          },
        ],
      },
    ],
    diagnostics: [
      {
        code: 'extension-root-not-found',
        severity: 'warning',
        path: '$.roots[2]',
        message: 'extension root not found; returning empty scan result for that root',
        source: '/Applications/GetTokens Dev.app/Contents/Resources/extensions',
      },
    ],
  } as main.GetTokensExtensionRegistrySnapshot;
}

export function getGetTokensExtensionCodexConfigDryRunPreview(): main.GetTokensExtensionCodexConfigDryRunPreview {
  return {
    contractVersion: '0.1.0',
    dryRun: true,
    generatedAt: '2026-06-17T08:45:00Z',
    target: 'codex-config',
    targetPath: '~/.codex/config.toml',
    summary: {
      enabledExtensionCount: 1,
      skippedExtensionCount: 1,
      operationCount: 2,
      validationErrorCount: 0,
    },
    sections: [
      {
        id: 'skills.config',
        label: 'Codex Skills Config',
        status: 'preview',
        diffPreview: [
          '# dry-run: candidate [[skills.config]] projections will appear here',
          '# boundary: preview only; no Codex config file is read or written',
          '# + candidate [[skills.config]] from extension "com.example.openai-metadata"',
          '# + capability = "provider-openai"',
          '# + contribution = "provider:openai"',
          '# + enabled = false',
        ],
      },
      {
        id: 'mcp_servers',
        label: 'Codex MCP Servers',
        status: 'preview',
        diffPreview: [
          '# dry-run: candidate [mcp_servers.<id>] projections will appear here',
          '# boundary: preview only; no Codex config file is read or written',
          '# + candidate [mcp_servers.com-example-openai-metadata-catalog-openai] from extension "com.example.openai-metadata"',
          '# + capability = "catalog-openai"',
          '# + contribution = "provider:openai/model:gpt-4.1"',
          '# + transport = "preview-only"',
        ],
      },
    ],
    operations: [
      {
        id: 'skills.config:com.example.openai-metadata:provider-openai',
        target: 'skills.config',
        action: 'preview',
        extensionID: 'com.example.openai-metadata',
        capabilityID: 'provider-openai',
        preview:
          '# + candidate [[skills.config]] from extension "com.example.openai-metadata"\n# + capability = "provider-openai"\n# + contribution = "provider:openai"\n# + enabled = false',
        patchPlan: {
          targetSection: 'skills.config',
          operation: 'append-array-table-preview',
          beforeSnippet:
            '# before: dry-run does not read ~/.codex/config.toml\n# before: no matching [[skills.config]] block is assumed',
          afterSnippet:
            '[[skills.config]]\n# source_extension = "com.example.openai-metadata"\n# source_capability = "provider-openai"\n# contribution = "provider:openai"\n# path is intentionally omitted until a future explicit Codex skill install path exists',
          validation: [
            'dry-run-only',
            'no-target-config-read',
            'no-target-config-write',
            'local-patch-plan-only',
          ],
        },
      } as main.GetTokensExtensionCodexConfigDryRunOperation,
      {
        id: 'mcp_servers:com.example.openai-metadata:catalog-openai',
        target: 'mcp_servers',
        action: 'preview',
        extensionID: 'com.example.openai-metadata',
        capabilityID: 'catalog-openai',
        preview:
          '# + candidate [mcp_servers.com-example-openai-metadata-catalog-openai] from extension "com.example.openai-metadata"\n# + capability = "catalog-openai"\n# + contribution = "provider:openai/model:gpt-4.1"\n# + transport = "preview-only"',
        patchPlan: {
          targetSection: 'mcp_servers.com-example-openai-metadata-catalog-openai',
          operation: 'upsert-parent-table-preview',
          beforeSnippet:
            '# before: dry-run does not read ~/.codex/config.toml\n# before: [mcp_servers.com-example-openai-metadata-catalog-openai] is not assumed to exist',
          afterSnippet:
            '[mcp_servers.com-example-openai-metadata-catalog-openai]\n# source_extension = "com.example.openai-metadata"\n# source_capability = "catalog-openai"\n# contribution = "provider:openai/model:gpt-4.1"\n# transport is intentionally unresolved in Extension Contract v0 dry-run\n# bearer_token_env_var is the only supported token reference in any future patch',
          validation: [
            'dry-run-only',
            'no-target-config-read',
            'no-target-config-write',
            'mcp-parent-server-table-only',
            'nested-tools-and-oauth-remain-owned-by-parent-server',
            'bearer-token-literal-forbidden',
          ],
        },
      } as main.GetTokensExtensionCodexConfigDryRunOperation,
    ],
    validation: [
      {
        code: 'codex-config-projection-only',
        severity: 'warning',
        extensionID: 'com.example.openai-metadata',
        capabilityID: 'provider-openai',
        target: 'codex-config',
        message:
          'capability "provider-openai" (provider-metadata) produced a dry-run candidate only; no save/apply operation is available',
      },
      {
        code: 'codex-config-projection-only',
        severity: 'warning',
        extensionID: 'com.example.openai-metadata',
        capabilityID: 'catalog-openai',
        target: 'codex-config',
        message:
          'capability "catalog-openai" (model-catalog-source) produced a dry-run candidate only; no save/apply operation is available',
      },
    ],
    convertValues(value: unknown) {
      return value;
    },
  };
}
