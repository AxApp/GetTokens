import type { OpenAICompatibleProvider } from '../../accounts/model/openAICompatible';

export interface CodexModelMappingRow {
  realModel: string;
  codexModel: string;
}

export interface CodexAuthFileModelLike {
  id?: unknown;
  name?: unknown;
  display_name?: unknown;
  alias?: unknown;
}

export function buildCodexAuthFileModelMappings(models: CodexAuthFileModelLike[]): CodexModelMappingRow[] {
  const seen = new Set<string>();
  const mappings: CodexModelMappingRow[] = [];
  for (const model of models || []) {
    const modelName = String(model.id || model.name || model.display_name || '').trim();
    if (!modelName || seen.has(modelName)) {
      continue;
    }
    seen.add(modelName);
    mappings.push({
      realModel: modelName,
      codexModel: modelName,
    });
  }
  return mappings;
}

export function mergeCodexAuthFileModelMappings(
  _models: CodexAuthFileModelLike[],
  aliases: CodexAuthFileModelLike[],
): CodexModelMappingRow[] {
  const seen = new Set<string>();
  const mappings: CodexModelMappingRow[] = [];
  for (const alias of aliases || []) {
    const realModel = String(alias.name || alias.id || '').trim();
    const codexModel = String(alias.alias || alias.display_name || '').trim();
    const key = `${realModel}\u0000${codexModel}`;
    if (!realModel || !codexModel || realModel === codexModel || seen.has(key)) {
      continue;
    }
    seen.add(key);
    mappings.push({ realModel, codexModel });
  }
  return mappings;
}

export function buildCodexModelOptionNames(mappings: CodexModelMappingRow[]): string[] {
  const seen = new Set<string>();
  const names: string[] = [];
  for (const mapping of mappings || []) {
    const name = String(mapping.realModel || '').trim();
    if (!name || seen.has(name)) {
      continue;
    }
    seen.add(name);
    names.push(name);
  }
  return names;
}

export function buildCodexModelAliasOptionNames(mappings: CodexModelMappingRow[]): string[] {
  const seen = new Set<string>();
  const names: string[] = [];
  for (const mapping of mappings || []) {
    [mapping.codexModel, mapping.realModel].forEach((value) => {
      const name = String(value || '').trim();
      if (!name || seen.has(name)) {
        return;
      }
      seen.add(name);
      names.push(name);
    });
  }
  return names;
}

export function buildOpenAICompatibleModelMappings(
  provider: { models?: OpenAICompatibleProvider['models'] },
): CodexModelMappingRow[] {
  return (provider.models || [])
    .map((model) => {
      const realModel = String(model.name || '').trim();
      if (!realModel) {
        return null;
      }
      const codexModel = String(model.alias || '').trim() || realModel;
      return {
        realModel,
        codexModel,
      };
    })
    .filter((row): row is CodexModelMappingRow => row !== null);
}

export function normalizeCodexModelMappingsForProvider(
  mappings: CodexModelMappingRow[],
): Array<{ name: string; alias: string }> {
  const normalized: Array<{ name: string; alias: string }> = [];
  const seen = new Set<string>();
  for (const mapping of mappings) {
    const realModel = String(mapping.realModel || '').trim();
    const codexModel = String(mapping.codexModel || '').trim();
    const alias = codexModel && codexModel !== realModel ? codexModel : '';
    const key = `${realModel}\u0000${alias}`;
    if (!realModel || seen.has(key)) {
      continue;
    }
    seen.add(key);
    normalized.push({
      name: realModel,
      alias,
    });
  }
  return normalized;
}
