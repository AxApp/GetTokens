import { useCallback, useRef, useState } from 'react';
import {
  GetAllQuotaStatuses,
  GetCodexQuota,
  GetCodexQuotaBatchRefreshJob,
  GetQuotaStatuses,
  RefreshCodexQuotasBatch,
  StartCodexQuotasBatchRefreshJob,
} from '../../../../wailsjs/go/main/App';
import { main } from '../../../../wailsjs/go/models';
import type { AccountRecord } from '../../../types';
import { hasWailsAppBindings } from '../../../utils/previewMode';
import { beginQuotaRefreshState, failQuotaRefreshState, supportsQuota } from '../model/accountQuota';
import { persistAccountQuotaStates, readStoredAccountQuotaStates } from '../model/accountQuotaCache';
import { chunkRuntimeSyncAccountKeys } from '../model/accountRuntimeSync';
import { getAccountsPreviewQuotaStateByKey } from '../previewData';
import type { CodexQuotaState, TrackRequest } from '../model/types';

export default function useAccountsQuotaState(trackRequest: TrackRequest) {
  const [codexQuotaByName, setCodexQuotaByName] = useState<Record<string, CodexQuotaState>>({});
  const quotaRequestIdRef = useRef(0);

  const syncCodexQuotaStatuses = useCallback(
    async (items: AccountRecord[], options: { replace?: boolean } = {}) => {
      if (!hasWailsAppBindings()) {
        setCodexQuotaByName(getAccountsPreviewQuotaStateByKey(items));
        return;
      }

      const codexAccounts = items.filter((account) => supportsQuota(account) && account.quotaKey);
      const quotaKeys = resolveQuotaStatusKeys(codexAccounts);
      const cachedQuotaByName = readStoredAccountQuotaStates(
        typeof window === 'undefined' ? null : window.localStorage,
        quotaKeys,
      );
      quotaRequestIdRef.current += 1;
      const requestID = quotaRequestIdRef.current;

      if (codexAccounts.length === 0) {
        if (options.replace !== false) {
          setCodexQuotaByName({});
        }
        return;
      }

      let quotaStatuses: any[] = [];
      try {
        const quotaStatusChunks = chunkRuntimeSyncAccountKeys(quotaKeys);
        for (let chunkIndex = 0; chunkIndex < quotaStatusChunks.length; chunkIndex += 1) {
          const quotaStatusChunk = quotaStatusChunks[chunkIndex];
          const chunkStatuses = await trackRequest(
            'GetQuotaStatuses',
            { accountKeys: quotaStatusChunk, chunkIndex: chunkIndex + 1, chunkCount: quotaStatusChunks.length },
            () => GetQuotaStatuses(quotaStatusChunk),
          );
          quotaStatuses.push(...(chunkStatuses || []));
        }
      } catch (error) {
        console.error(error);
        try {
          quotaStatuses = await trackRequest('GetAllQuotaStatuses', { args: [], fallback: true }, () =>
            GetAllQuotaStatuses(),
          );
        } catch (fallbackError) {
          console.error(fallbackError);
          if (Object.keys(cachedQuotaByName).length === 0) {
            return;
          }
        }
      }

      if (quotaRequestIdRef.current !== requestID) {
        return;
      }

      const accountKeySet = new Set(quotaKeys);
      const runtimeQuotaByName = (quotaStatuses || []).reduce<Record<string, CodexQuotaState>>(
        (result, quota) => {
          const key = String(quota?.accountKey || '').trim();
          if (key && accountKeySet.has(key)) {
            result[key] = { status: 'success', quota } satisfies CodexQuotaState;
          }
          return result;
        }, {}
      );

      setCodexQuotaByName((prev) => {
        const nextQuotaByName = codexAccounts.reduce<Record<string, CodexQuotaState>>((result, account) => {
          const key = account.quotaKey!;
          result[key] =
            runtimeQuotaByName[key] ||
            cachedQuotaByName[key] ||
            prev[key] ||
            emptyRuntimeQuotaState(account);
          return result;
        }, {});
        const next = options.replace === false ? { ...prev, ...nextQuotaByName } : nextQuotaByName;
        persistAccountQuotaStates(typeof window === 'undefined' ? null : window.localStorage, next);
        return next;
      });
    },
    [trackRequest]
  );

  const loadCodexQuotas = useCallback(
    async (items: AccountRecord[]) => {
      await syncCodexQuotaStatuses(items);
    },
    [syncCodexQuotaStatuses],
  );

  const refreshCodexQuota = useCallback(
    async (account: AccountRecord) => {
      if (!hasWailsAppBindings()) {
        setCodexQuotaByName((prev) => ({
          ...prev,
          ...getAccountsPreviewQuotaStateByKey([account]),
        }));
        return;
      }

      if (!supportsQuota(account) || !account.quotaKey) {
        return;
      }

      setCodexQuotaByName((prev) => ({
        ...prev,
        [account.quotaKey!]: beginQuotaRefreshState(prev[account.quotaKey!]),
      }));

      try {
        const quota = await trackRequest('GetCodexQuota', { name: account.quotaKey }, () =>
          GetCodexQuota(account.quotaKey!)
        );
        setCodexQuotaByName((prev) => {
          const nextQuotaByName = {
            ...prev,
            [account.quotaKey!]: { status: 'success', quota } satisfies CodexQuotaState,
          };
          persistAccountQuotaStates(typeof window === 'undefined' ? null : window.localStorage, nextQuotaByName);
          return nextQuotaByName;
        });
      } catch (error) {
        console.error(error);
        setCodexQuotaByName((prev) => ({
          ...prev,
          [account.quotaKey!]: failQuotaRefreshState(prev[account.quotaKey!], error),
        }));
      }
    },
    [trackRequest]
  );

  const refreshCodexQuotasBatch = useCallback(
    async (items: AccountRecord[]) => {
      const targets = resolveQuotaRefreshTargets(items);
      if (targets.length === 0) {
        return { succeeded: 0, failed: 0 };
      }

      if (!hasWailsAppBindings()) {
        setCodexQuotaByName((prev) => ({
          ...prev,
          ...getAccountsPreviewQuotaStateByKey(targets),
        }));
        return { succeeded: targets.length, failed: 0 };
      }

      const accountByQuotaKey = new Map(targets.map((account) => [account.quotaKey!, account]));
      const quotaKeys = targets.map((account) => account.quotaKey!);
      setCodexQuotaByName((prev) => {
        const next = { ...prev };
        quotaKeys.forEach((key) => {
          next[key] = beginQuotaRefreshState(prev[key]);
        });
        return next;
      });

      let startedJob: any;
      try {
        startedJob = await startCodexQuotaBatchRefreshJob(trackRequest, quotaKeys);
      } catch (jobStartError) {
        console.error(jobStartError);
        try {
          return await applyCodexQuotaBatchRefreshResult(
            await trackRequest('RefreshCodexQuotasBatch', { accountKeys: quotaKeys, fallback: true }, () =>
              RefreshCodexQuotasBatch(buildCodexQuotaBatchRefreshInput(quotaKeys))
            ),
            { accountByQuotaKey, quotaKeys, setCodexQuotaByName },
          );
        } catch (error) {
          console.error(error);
          setCodexQuotaByName((prev) => markQuotaBatchRefreshFailed(prev, quotaKeys, error));
          throw error;
        }
      }

      try {
        const result = isQuotaBatchRefreshJobComplete(startedJob)
          ? startedJob
          : await pollCodexQuotaBatchRefreshJob(trackRequest, String(startedJob?.jobID || '').trim());
        return await applyCodexQuotaBatchRefreshResult(result, { accountByQuotaKey, quotaKeys, setCodexQuotaByName });
      } catch (error) {
        console.error(error);
        setCodexQuotaByName((prev) => markQuotaBatchRefreshFailed(prev, quotaKeys, error));
        throw error;
      }
    },
    [trackRequest],
  );

  return {
    codexQuotaByName,
    loadCodexQuotas,
    syncCodexQuotaStatuses,
    refreshCodexQuota,
    refreshCodexQuotasBatch,
  };
}

const QUOTA_BATCH_REFRESH_JOB_POLL_INTERVAL_MS = 500;
const QUOTA_BATCH_REFRESH_JOB_MAX_POLLS = 240;

function buildCodexQuotaBatchRefreshInput(quotaKeys: string[]) {
  return main.CodexQuotaBatchRefreshInput.createFrom({
    accountKeys: quotaKeys,
    includeBilling: true,
    concurrency: 4,
  });
}

async function startCodexQuotaBatchRefreshJob(trackRequest: TrackRequest, quotaKeys: string[]) {
  const started = await trackRequest('StartCodexQuotasBatchRefreshJob', { accountKeys: quotaKeys }, () =>
    StartCodexQuotasBatchRefreshJob(buildCodexQuotaBatchRefreshInput(quotaKeys)),
  );
  const jobID = String(started?.jobID || '').trim();
  if (!jobID) {
    throw new Error('Quota refresh job did not return a job id.');
  }
  return started;
}

async function pollCodexQuotaBatchRefreshJob(trackRequest: TrackRequest, jobID: string) {
  if (!jobID) {
    throw new Error('Quota refresh job did not return a job id.');
  }
  for (let attempt = 0; attempt < QUOTA_BATCH_REFRESH_JOB_MAX_POLLS; attempt += 1) {
    await waitForQuotaBatchRefreshJobPoll();
    const snapshot = await trackRequest('GetCodexQuotaBatchRefreshJob', { jobID }, () =>
      GetCodexQuotaBatchRefreshJob(jobID),
    );
    if (isQuotaBatchRefreshJobComplete(snapshot)) {
      return snapshot;
    }
  }
  throw new Error('Quota refresh job timed out.');
}

async function applyCodexQuotaBatchRefreshResult(
  result: any,
  {
    accountByQuotaKey,
    quotaKeys,
    setCodexQuotaByName,
  }: {
    accountByQuotaKey: Map<string, AccountRecord>;
    quotaKeys: string[];
    setCodexQuotaByName: (updater: (prev: Record<string, CodexQuotaState>) => Record<string, CodexQuotaState>) => void;
  },
) {
  const refreshedKeys = new Set<string>();
  const failedByKey = new Map<string, string>();
  (result?.errors || []).forEach((item: any) => {
    const key = String(item?.accountKey || '').trim();
    if (key) {
      failedByKey.set(key, String(item?.error || 'Quota refresh failed.'));
    }
  });
  setCodexQuotaByName((prev) => {
    const next = { ...prev };
    (result?.items || []).forEach((quota: any) => {
      const key = String(quota?.accountKey || '').trim();
      if (!key || !accountByQuotaKey.has(key)) {
        return;
      }
      refreshedKeys.add(key);
      next[key] = { status: 'success', quota } satisfies CodexQuotaState;
    });
    failedByKey.forEach((message, key) => {
      next[key] = failQuotaRefreshState(next[key] || prev[key], new Error(message));
    });
    persistAccountQuotaStates(typeof window === 'undefined' ? null : window.localStorage, next);
    return next;
  });
  return {
    succeeded: Number(result?.succeeded ?? refreshedKeys.size),
    failed: Number(result?.failed ?? failedByKey.size),
  };
}

function markQuotaBatchRefreshFailed(
  prev: Record<string, CodexQuotaState>,
  quotaKeys: string[],
  error: unknown,
): Record<string, CodexQuotaState> {
  const next = { ...prev };
  quotaKeys.forEach((key) => {
    next[key] = failQuotaRefreshState(prev[key], error);
  });
  return next;
}

function isQuotaBatchRefreshJobComplete(job: any) {
  const status = String(job?.status || '').trim().toLowerCase();
  return status === 'succeeded' || status === 'failed' || status === 'canceled';
}

function waitForQuotaBatchRefreshJobPoll() {
  return new Promise((resolve) => {
    setTimeout(resolve, QUOTA_BATCH_REFRESH_JOB_POLL_INTERVAL_MS);
  });
}

function resolveQuotaStatusKeys(items: AccountRecord[]) {
  const keys: string[] = [];
  const seen = new Set<string>();
  items.forEach((account) => {
    const key = String(account.quotaKey || '').trim();
    if (!key || seen.has(key)) {
      return;
    }
    seen.add(key);
    keys.push(key);
  });
  return keys;
}

function resolveQuotaRefreshTargets(items: AccountRecord[]) {
  const seen = new Set<string>();
  const targets: AccountRecord[] = [];
  items.forEach((account) => {
    if (!supportsQuota(account) || !account.quotaKey || seen.has(account.quotaKey)) {
      return;
    }
    seen.add(account.quotaKey);
    targets.push(account);
  });
  return targets;
}

function emptyRuntimeQuotaState(account: AccountRecord): CodexQuotaState {
  return {
    status: 'success',
    quota: {
      accountKey: account.quotaKey || account.id,
      status: 'stale',
      planType: account.planType || '',
      windows: [],
      stale: true,
      degradedReason: 'Quota runtime status has not been observed yet.',
      blocked: false,
      sources: [],
    } as any,
  };
}
