import type { main } from '../../../../wailsjs/go/models';
import {
  RELAY_CODEX_DEFAULT_REASONING_EFFORT,
  RELAY_CODEX_REASONING_EFFORT_OPTIONS,
} from '../../accounts/model/accountConfig.ts';

export interface RelayResolvedModelOption {
  name: string;
  alias: string;
  supportedReasoningEfforts: string[];
  defaultReasoningEffort: string;
  fromAccountPool: boolean;
  fromCustom: boolean;
}

const relayReasoningEffortOptions = RELAY_CODEX_REASONING_EFFORT_OPTIONS as readonly string[];

export function mergeRelayModelCatalog(
  accountPoolModels: main.OpenAICompatibleModel[] | undefined,
  customModelNames: string[] | undefined,
): RelayResolvedModelOption[] {
  const merged = new Map<string, RelayResolvedModelOption>();

  for (const model of accountPoolModels || []) {
    const name = String(model?.name || '').trim();
    if (!name) {
      continue;
    }

    const current = merged.get(name);
    const next = mergeRelayResolvedModelOption(current, {
      name,
      alias: String(model?.alias || '').trim(),
      supportedReasoningEfforts: normalizeRelayReasoningEfforts(model?.supportedReasoningEfforts),
      defaultReasoningEffort: normalizeCatalogReasoningEffort(model?.defaultReasoningEffort),
      fromAccountPool: true,
      fromCustom: current?.fromCustom || false,
    });
    merged.set(name, next);
  }

  for (const rawName of customModelNames || []) {
    const name = String(rawName || '').trim();
    if (!name) {
      continue;
    }

    const current = merged.get(name);
    merged.set(
      name,
      mergeRelayResolvedModelOption(current, {
        name,
        alias: current?.alias || '',
        supportedReasoningEfforts: current?.supportedReasoningEfforts || [],
        defaultReasoningEffort: current?.defaultReasoningEffort || '',
        fromAccountPool: current?.fromAccountPool || false,
        fromCustom: true,
      }),
    );
  }

  return Array.from(merged.values());
}

export function resolveRelayModelReasoningProfile(
  modelName: string,
  catalog: RelayResolvedModelOption[],
): {
  options: string[];
  defaultValue: string;
} {
  const matched = catalog.find((item) => item.name === modelName);
  const options = matched?.supportedReasoningEfforts?.length
    ? matched.supportedReasoningEfforts
    : [...relayReasoningEffortOptions];
  const normalizedDefault = normalizeCatalogReasoningEffort(matched?.defaultReasoningEffort);
  const defaultValue = options.includes(normalizedDefault)
    ? normalizedDefault
    : options.includes(RELAY_CODEX_DEFAULT_REASONING_EFFORT)
      ? RELAY_CODEX_DEFAULT_REASONING_EFFORT
      : (options[0] || RELAY_CODEX_DEFAULT_REASONING_EFFORT);

  return {
    options,
    defaultValue,
  };
}

export function sortRelayModelCatalogByNameDesc(catalog: RelayResolvedModelOption[]): RelayResolvedModelOption[] {
  return [...catalog].sort((left, right) => right.name.localeCompare(left.name));
}

export function filterRelayModelCatalogByQuery(
  catalog: RelayResolvedModelOption[],
  query: string,
): RelayResolvedModelOption[] {
  const normalizedQuery = String(query || '').trim().toLowerCase();
  if (!normalizedQuery) {
    return [...catalog];
  }

  return catalog.filter((item) => {
    const name = item.name.toLowerCase();
    const alias = item.alias.toLowerCase();
    return name.includes(normalizedQuery) || alias.includes(normalizedQuery);
  });
}

function mergeRelayResolvedModelOption(
  current: RelayResolvedModelOption | undefined,
  incoming: RelayResolvedModelOption,
): RelayResolvedModelOption {
  if (!current) {
    return {
      ...incoming,
      supportedReasoningEfforts: normalizeRelayReasoningEfforts(incoming.supportedReasoningEfforts),
      defaultReasoningEffort: normalizeCatalogReasoningEffort(incoming.defaultReasoningEffort),
    };
  }

  const supportedReasoningEfforts = normalizeRelayReasoningEfforts([
    ...current.supportedReasoningEfforts,
    ...incoming.supportedReasoningEfforts,
  ]);
  const defaultReasoningEffort =
    normalizeCatalogReasoningEffort(current.defaultReasoningEffort) ||
    normalizeCatalogReasoningEffort(incoming.defaultReasoningEffort);

  return {
    name: current.name,
    alias: current.alias || incoming.alias,
    supportedReasoningEfforts,
    defaultReasoningEffort,
    fromAccountPool: current.fromAccountPool || incoming.fromAccountPool,
    fromCustom: current.fromCustom || incoming.fromCustom,
  };
}

function normalizeRelayReasoningEfforts(values: string[] | undefined): string[] {
  const normalized: string[] = [];
  const seen = new Set<string>();
  for (const value of values || []) {
    const effort = normalizeCatalogReasoningEffort(value);
    if (!effort || seen.has(effort)) {
      continue;
    }
    seen.add(effort);
    normalized.push(effort);
  }
  return normalized;
}

function normalizeCatalogReasoningEffort(value: string | undefined): string {
  const trimmed = String(value || '').trim().toLowerCase();
  return relayReasoningEffortOptions.includes(trimmed) ? trimmed : '';
}
