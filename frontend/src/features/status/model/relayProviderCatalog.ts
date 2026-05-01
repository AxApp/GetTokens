import { normalizeRelayProviderOption } from '../../accounts/model/accountConfig.ts';

export interface RelayProviderOptionLike {
  id?: string;
  name?: string;
  providerID?: string;
  providerName?: string;
}

export interface RelayProviderOption {
  id: string;
  name: string;
}

export function mergeRelayProviderCatalog(...groups: Array<Array<RelayProviderOptionLike> | undefined>): RelayProviderOption[] {
  const merged = new Map<string, RelayProviderOption>();

  for (const group of groups) {
    for (const item of group || []) {
      const normalized = normalizeRelayProviderOption({
        providerID: item?.providerID ?? item?.id,
        providerName: item?.providerName ?? item?.name,
      });
      if (!normalized.providerID) {
        continue
      }
      merged.set(normalized.providerID, {
        id: normalized.providerID,
        name: normalized.providerName,
      });
    }
  }

  return Array.from(merged.values());
}
