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
  return normalized.sort(compareAPIKeyModelNames);
}

function compareAPIKeyModelNames(left: string, right: string): number {
  const leftKey = buildAPIKeyModelSortKey(left);
  const rightKey = buildAPIKeyModelSortKey(right);

  if (leftKey.family !== rightKey.family) {
    return leftKey.family.localeCompare(rightKey.family);
  }

  const maxParts = Math.max(leftKey.numbers.length, rightKey.numbers.length);
  for (let index = 0; index < maxParts; index += 1) {
    const leftPart = leftKey.numbers[index] ?? 0;
    const rightPart = rightKey.numbers[index] ?? 0;
    if (leftPart !== rightPart) {
      return rightPart - leftPart;
    }
  }

  if (leftKey.sizeRank !== rightKey.sizeRank) {
    return rightKey.sizeRank - leftKey.sizeRank;
  }

  return leftKey.normalizedName.localeCompare(rightKey.normalizedName);
}

function buildAPIKeyModelSortKey(name: string) {
  const normalizedName = String(name || '').trim().toLowerCase();
  const firstDigitIndex = normalizedName.search(/\d/);
  const family =
    firstDigitIndex >= 0
      ? normalizedName.slice(0, firstDigitIndex).replace(/[-_.\s]+$/g, '') || normalizedName
      : normalizedName;
  const numbers = Array.from(normalizedName.matchAll(/\d+/g), (match) => Number.parseInt(match[0], 10)).filter(
    Number.isFinite,
  );

  return {
    family,
    numbers,
    sizeRank: resolveModelSizeRank(normalizedName),
    normalizedName,
  };
}

function resolveModelSizeRank(name: string): number {
  if (name.includes('nano')) return -4;
  if (name.includes('mini') || name.includes('lite')) return -3;
  if (name.includes('small')) return -2;
  return 0;
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
