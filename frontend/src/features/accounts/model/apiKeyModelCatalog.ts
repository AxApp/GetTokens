import type { OpenAICompatibleProvider } from './openAICompatible.ts';

export type APIKeyModelMenuMode = 'browse' | 'filter';

export function normalizeAPIKeyModelNames(modelNames: string[] | undefined): string[] {
  const normalized: string[] = [];
  const seen = new Set<string>();
  for (const modelName of modelNames || []) {
    const name = String(modelName || '').trim();
    if (!name || seen.has(name)) {
      continue;
    }
    seen.add(name);
    normalized.push(name);
  }
  return normalized;
}

export function resolveAPIKeyModelMenuNames(
  modelNames: string[] | undefined,
  verifyModel: string,
  mode: APIKeyModelMenuMode,
): string[] {
  const names = normalizeAPIKeyModelNames(modelNames);
  if (mode === 'browse') {
    return names;
  }

  const query = verifyModel.trim().toLowerCase();
  if (!query) {
    return names;
  }
  return names.filter((name) => name.toLowerCase().includes(query));
}

export function buildRelayModelProviderSignature(providers: OpenAICompatibleProvider[]): string {
  return JSON.stringify(
    providers
      .map((provider) => ({
        name: String(provider.name || '').trim(),
        baseUrl: String(provider.baseUrl || '').trim(),
        models: normalizeAPIKeyModelNames((provider.models || []).map((model) => model.name)),
      }))
      .sort((left, right) => left.name.localeCompare(right.name)),
  );
}
