export const API_KEY_LABELS_STORAGE_KEY = 'gettokens.apiKeyLabels';

export const emptyApiKeyForm = {
  label: '',
  apiKey: '',
  baseUrl: '',
  priority: '0',
  prefix: '',
};

export function normalizeBaseUrl(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return '';
  }

  try {
    const parsed = new URL(trimmed);
    return `${parsed.protocol}//${parsed.host}${parsed.pathname}`.replace(/\/+$/, '');
  } catch {
    return trimmed.replace(/\/+$/, '');
  }
}

export function normalizePrefix(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return '';
  }
  return trimmed.replace(/^\/+|\/+$/g, '');
}

export function formatCompactBaseUrl(value?: string) {
  const trimmed = String(value || '').trim();
  if (!trimmed) {
    return '--';
  }

  try {
    const parsed = new URL(trimmed);
    const path = parsed.pathname === '/' ? '' : parsed.pathname;
    return `${parsed.host}${path}`;
  } catch {
    return trimmed;
  }
}

function quoteYAMLString(value: string) {
  return JSON.stringify(value);
}

function normalizeManagedProviderID(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function resolveManagedProviderID(
  draft: {
    baseUrl?: string;
    prefix?: string;
  }
) {
  const baseUrl = normalizeBaseUrl(String(draft.baseUrl || '')) || '<FILL_BASE_URL>';
  const prefix = normalizePrefix(String(draft.prefix || ''));
  const host = (() => {
    try {
      return new URL(baseUrl).host;
    } catch {
      return '';
    }
  })();
  return normalizeManagedProviderID(prefix || host || 'provider-relay') || 'provider-relay';
}

export function buildManagedAuthJSONSnippet(
  draft: {
    apiKey?: string;
    baseUrl?: string;
  }
) {
  const apiKey = String(draft.apiKey || '').trim() || '<FILL_API_KEY>';
  const baseUrl = normalizeBaseUrl(String(draft.baseUrl || '')) || '<FILL_BASE_URL>';

  const payload: Record<string, unknown> = {
    auth_mode: 'apikey',
    OPENAI_API_KEY: apiKey,
    base_url: baseUrl,
  };

  return JSON.stringify(payload, null, 2);
}

export function buildManagedConfigTomlSnippet(
  draft: {
    baseUrl?: string;
    prefix?: string;
  }
) {
  const baseUrl = normalizeBaseUrl(String(draft.baseUrl || '')) || '<FILL_BASE_URL>';
  const providerID = resolveManagedProviderID(draft);

  const lines = [
    `model = ${quoteYAMLString('gpt-5.4')}`,
    `model_reasoning_effort = ${quoteYAMLString('high')}`,
    `model_provider = ${quoteYAMLString(providerID)}`,
    '',
    `[model_providers.${providerID}]`,
    `name = ${quoteYAMLString(providerID)}`,
    `base_url = ${quoteYAMLString(baseUrl)}`,
    'requires_openai_auth = true',
    `wire_api = ${quoteYAMLString('responses')}`,
  ];

  return lines.join('\n');
}

export function buildRelayCodexAuthJSONSnippet(
  draft: {
    apiKey?: string;
    model?: string;
  }
) {
  const apiKey = String(draft.apiKey || '').trim() || '<YOUR_API_KEY>';
  const model = String(draft.model || '').trim() || 'GT';

  return JSON.stringify(
    {
      auth_mode: 'apikey',
      OPENAI_API_KEY: apiKey,
      model,
    },
    null,
    2
  );
}

export function buildRelayCodexConfigTomlSnippet(
  draft: {
    baseUrl?: string;
    model?: string;
  }
) {
  const baseUrl = normalizeBaseUrl(String(draft.baseUrl || '')) || 'http://127.0.0.1:8317/v1';
  const model = String(draft.model || '').trim() || 'GT';

  return [`model = ${quoteYAMLString(model)}`, `openai_base_url = ${quoteYAMLString(baseUrl)}`].join('\n');
}

export function parseMaybeJSON(value: string) {
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

export function decodeBase64Utf8(value: string) {
  const binary = window.atob(value);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

export function buildAPIKeyLabelStorageKey(apiKey: string, baseUrl: string, prefix: string) {
  return JSON.stringify({
    apiKey: apiKey.trim(),
    baseUrl: normalizeBaseUrl(baseUrl),
    prefix: normalizePrefix(prefix),
  });
}

export function buildCodexAPIKeyVerifyInput(input: {
  apiKey?: string;
  baseUrl?: string;
  model?: string;
}) {
  return {
    apiKey: String(input.apiKey || '').trim(),
    baseUrl: normalizeBaseUrl(String(input.baseUrl || '')),
    model: String(input.model || '').trim(),
  };
}

export function loadAPIKeyLabels() {
  if (typeof window === 'undefined') {
    return {};
  }

  try {
    const raw = window.localStorage.getItem(API_KEY_LABELS_STORAGE_KEY);
    if (!raw) {
      return {};
    }
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') {
      return {};
    }
    return parsed as Record<string, string>;
  } catch {
    return {};
  }
}

export function persistAPIKeyLabels(labels: Record<string, string>) {
  if (typeof window === 'undefined') {
    return;
  }
  window.localStorage.setItem(API_KEY_LABELS_STORAGE_KEY, JSON.stringify(labels));
}

export function clearAPIKeyLabels() {
  if (typeof window === 'undefined') {
    return;
  }
  window.localStorage.removeItem(API_KEY_LABELS_STORAGE_KEY);
}

export function downloadTextFile(filename: string, content: string) {
  const blob = new Blob([content], { type: 'application/json;charset=utf-8' });
  const href = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = href;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(href);
}
