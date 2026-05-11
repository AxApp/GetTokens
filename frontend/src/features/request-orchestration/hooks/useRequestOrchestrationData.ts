import { useCallback, useEffect, useMemo, useState } from 'react';
import { ListAccounts, ListAuthFiles, ListOpenAICompatibleProviders } from '../../../../wailsjs/go/main/App';
import { useDebug } from '../../../context/DebugContext';
import type { AccountRecord, SidecarStatus } from '../../../types';
import { hasWailsAppBindings } from '../../../utils/previewMode';
import { mapAuthFileToRecord, mapBackendAccountRecord } from '../../accounts/model/accountPresentation.ts';
import { readStoredProxyNodes } from '../../proxy-pool/model.ts';
import {
  buildOpenAICompatibleModelMap,
  buildRequestAccountGroups,
  mapAccountRecordsToRequestAccounts,
  mapOpenAICompatibleProvidersToAccountRecords,
  mapProxyNodesToRequestRoutes,
  requestAccountGroups,
  requestAccounts,
  requestProxyRoutes,
  type RequestAccount,
  type RequestAccountGroup,
  type RequestProxyRoute,
} from '../model.ts';

function dedupeAccountRecordsByID(records: readonly AccountRecord[]): AccountRecord[] {
  const byID = new Map<string, AccountRecord>();
  for (const record of records) {
    byID.set(record.id, record);
  }
  return Array.from(byID.values());
}

export type RequestOrchestrationSourceKind = 'live' | 'preview' | 'blocked' | 'error';

export interface RequestOrchestrationDataState {
  accounts: RequestAccount[];
  groups: RequestAccountGroup[];
  routes: RequestProxyRoute[];
  loading: boolean;
  sourceKind: RequestOrchestrationSourceKind;
  sourceLabel: string;
  sourceMessage: string;
  refresh: () => void;
}

function readRequestRoutesFromLocalProxyPool(): RequestProxyRoute[] {
  if (typeof window === 'undefined') {
    return [{ id: 'direct', label: '直连', note: '系统出口，不走代理池' }];
  }

  return mapProxyNodesToRequestRoutes(readStoredProxyNodes(window.localStorage));
}

function buildPreviewState(): Pick<RequestOrchestrationDataState, 'accounts' | 'groups' | 'routes' | 'sourceKind' | 'sourceLabel' | 'sourceMessage'> {
  const localRoutes = readRequestRoutesFromLocalProxyPool();
  return {
    accounts: requestAccounts,
    groups: buildRequestAccountGroups(requestAccounts),
    routes: localRoutes.length > 1 ? localRoutes : requestProxyRoutes,
    sourceKind: 'preview',
    sourceLabel: 'preview',
    sourceMessage: '浏览器预览使用静态账号；代理出口优先读取本地代理池。',
  };
}

export default function useRequestOrchestrationData(sidecarStatus: SidecarStatus): RequestOrchestrationDataState {
  const { trackRequest } = useDebug();
  const [accounts, setAccounts] = useState<RequestAccount[]>([]);
  const [groups, setGroups] = useState<RequestAccountGroup[]>(requestAccountGroups);
  const [routes, setRoutes] = useState<RequestProxyRoute[]>(() => readRequestRoutesFromLocalProxyPool());
  const [loading, setLoading] = useState(false);
  const [sourceKind, setSourceKind] = useState<RequestOrchestrationSourceKind>('blocked');
  const [sourceMessage, setSourceMessage] = useState('等待 sidecar ready 后读取真实账号池。');
  const [reloadToken, setReloadToken] = useState(0);

  const refresh = useCallback(() => {
    setReloadToken((value) => value + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const wailsReady = hasWailsAppBindings();
    const nextRoutes = readRequestRoutesFromLocalProxyPool();
    setRoutes(nextRoutes);

    if (!wailsReady) {
      const preview = buildPreviewState();
      setAccounts(preview.accounts);
      setGroups(preview.groups);
      setRoutes(preview.routes);
      setSourceKind(preview.sourceKind);
      setSourceMessage(preview.sourceMessage);
      setLoading(false);
      return () => {
        cancelled = true;
      };
    }

    if (sidecarStatus.code !== 'ready') {
      setAccounts([]);
      setGroups(requestAccountGroups);
      setSourceKind('blocked');
      setSourceMessage('sidecar 未 ready，暂不读取账号池。');
      setLoading(false);
      return () => {
        cancelled = true;
      };
    }

    async function loadLiveData() {
      setLoading(true);
      try {
        const [authFileResponse, rawAccountResponse, openAICompatibleProviders] = await Promise.all([
          trackRequest('RequestOrchestration.ListAuthFiles', { args: [] }, () => ListAuthFiles()),
          trackRequest('RequestOrchestration.ListAccounts', { args: [] }, () => ListAccounts()),
          trackRequest('RequestOrchestration.ListOpenAICompatibleProviders', { args: [] }, () => ListOpenAICompatibleProviders()),
        ]);
        if (cancelled) {
          return;
        }

        const authFileRecords = (authFileResponse.files || []).map((account) => mapAuthFileToRecord(account));
        const apiKeyRecords = (rawAccountResponse || [])
          .map((account) => mapBackendAccountRecord(account))
          .filter((account): account is AccountRecord => account.credentialSource === 'api-key');
        const modelMap = buildOpenAICompatibleModelMap(openAICompatibleProviders || []);
        const openAICompatibleRecords = mapOpenAICompatibleProvidersToAccountRecords(openAICompatibleProviders || []);
        const nextAccounts = mapAccountRecordsToRequestAccounts(
          dedupeAccountRecordsByID([...authFileRecords, ...apiKeyRecords, ...openAICompatibleRecords]),
          modelMap,
        );
        setAccounts(nextAccounts);
        setGroups(buildRequestAccountGroups(nextAccounts));
        setRoutes(readRequestRoutesFromLocalProxyPool());
        setSourceKind('live');
        setSourceMessage(
          nextAccounts.length > 0
            ? `已读取真实账号 ${nextAccounts.length} 个，代理出口来自本地代理池。`
            : '真实账号池为空；请先在账号池添加账号。',
        );
      } catch (error) {
        if (cancelled) {
          return;
        }
        console.error(error);
        setAccounts([]);
        setGroups(requestAccountGroups);
        setSourceKind('error');
        setSourceMessage(error instanceof Error ? error.message : '读取请求编排数据失败。');
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadLiveData();
    return () => {
      cancelled = true;
    };
  }, [reloadToken, sidecarStatus.code, trackRequest]);

  return useMemo(
    () => ({
      accounts,
      groups,
      routes,
      loading,
      sourceKind,
      sourceLabel: sourceKind,
      sourceMessage,
      refresh,
    }),
    [accounts, groups, loading, refresh, routes, sourceKind, sourceMessage],
  );
}
