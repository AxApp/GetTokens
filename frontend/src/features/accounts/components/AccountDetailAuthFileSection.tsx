import { useEffect, useState } from 'react';
import {
  DownloadAuthFile,
  NormalizeAuthFileContent,
} from '../../../../wailsjs/go/main/App';
import { useDebug } from '../../../context/useDebug';
import type { AccountRecord } from '../../../types';
import { hasWailsAppBindings } from '../../../utils/previewMode';
import { decodeBase64Utf8, parseMaybeJSON } from '../model/accountConfig';
import {
  AccountDetailSection,
  AccountDetailPill,
} from './AccountDetailPrimitives';
import { getAccountsPreviewAuthFileContent } from '../previewData';

const buttonClass =
  'inline-flex h-9 items-center justify-center gap-1.5 rounded-md border border-[var(--gt-border-default)] bg-[var(--gt-surface-panel)] px-3 text-xs font-medium text-[var(--gt-ink-primary)] transition hover:bg-[var(--gt-surface-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gt-focus-ring)] focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50';
const inputClass =
  'w-full rounded-md border border-[var(--gt-border-default)] bg-white px-3 py-2 text-sm text-[var(--gt-ink-primary)] outline-none transition focus:border-[var(--gt-focus-ring)]';
const labelClass =
  'text-xs font-medium text-[var(--gt-ink-muted)]';
const noticeClass =
  'rounded-md border border-[var(--gt-border-default)] bg-[var(--gt-surface-panel)] px-3 py-2 text-xs text-[var(--gt-ink-muted)]';

export function AuthFileSummarySection({ account }: { account: AccountRecord }) {
  const { trackRequest } = useDebug();
  const [rawContent, setRawContent] = useState('');
  const [sanitizedContent, setSanitizedContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [sanitizing, setSanitizing] = useState(false);
  const [copyState, setCopyState] = useState<'idle' | 'success' | 'error'>('idle');

  useEffect(() => {
    if (!account.name) return;
    let cancelled = false;
    setLoading(true);
    void (async () => {
      try {
        if (!hasWailsAppBindings()) {
          const content = getAccountsPreviewAuthFileContent(account.name!);
          if (cancelled) return;
          setRawContent(content);
          setLoading(false);
          return;
        }
        const result = await trackRequest('DownloadAuthFile', { name: account.name }, () => DownloadAuthFile(account.name!));
        if (cancelled) return;
        const decoded = decodeBase64Utf8(result?.contentBase64 ?? '');
        const pretty = parseMaybeJSON(decoded);
        setRawContent(typeof pretty === 'string' ? pretty : JSON.stringify(pretty, null, 2));
      } catch {
        // ignore detail read errors in modal
      }
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [account.name, trackRequest]);

  async function handleSanitize() {
    setSanitizing(true);
    try {
      const result = await trackRequest('NormalizeAuthFileContent', { content: rawContent }, () => NormalizeAuthFileContent(rawContent));
      setSanitizedContent(result);
    } catch {
      // ignore sanitize errors in modal
    }
    setSanitizing(false);
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(sanitizedContent || rawContent);
      setCopyState('success');
      setTimeout(() => setCopyState('idle'), 2000);
    } catch {
      setCopyState('error');
    }
  }

  const displayed = sanitizedContent || rawContent;

  return (
    <AccountDetailSection
      componentName="AuthFileSummarySection"
      title="配置管理"
      actions={
        <>
          <AccountDetailPill>{sanitizedContent ? 'PREVIEW READY' : 'PREVIEW ON DEMAND'}</AccountDetailPill>
          <AccountDetailPill>{loading ? 'LOADING' : 'READY'}</AccountDetailPill>
          <button data-auth-file-config-action="preview" onClick={handleSanitize} disabled={sanitizing || loading} className={buttonClass}>
            {sanitizing ? '...' : '预览配置'}
          </button>
          <button data-auth-file-config-action="download" onClick={handleCopy} disabled={!displayed} className={buttonClass}>
            {copyState === 'success' ? '已下载' : copyState === 'error' ? '失败' : '下载配置'}
          </button>
          <button data-auth-file-config-action="apply" onClick={handleCopy} disabled={!displayed} className={buttonClass}>
            应用配置
          </button>
        </>
      }
    >
      <div data-auth-file-config-management="quiet" className="grid gap-3">
        <div className="space-y-2">
          <label className="grid gap-1.5">
            <span className={labelClass}>账号名称</span>
            <input className={inputClass} value={account.displayName} readOnly />
          </label>
        </div>
      </div>
      {loading ? (
        <div className="mt-4 animate-pulse space-y-2">
          <div className="h-4 w-3/4 bg-[var(--border-color)]" />
          <div className="h-4 w-1/2 bg-[var(--border-color)]" />
        </div>
      ) : (
        <div data-auth-file-config-notice="true" className={`mt-4 ${noticeClass}`}>
          配置预览基于账号数据库生成；可预览配置、下载配置，并在确认后应用到运行时。待接入 account-store management API。
        </div>
      )}
    </AccountDetailSection>
  );
}
