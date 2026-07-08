import { useEffect, useState } from 'react';
import { Button, Input, Tooltip } from 'antd';
import {
  DownloadAuthFile,
  NormalizeAuthFileContent,
} from '../../../../wailsjs/go/main/App';
import { useDebug } from '../../../context/useDebug';
import type { AccountRecord } from '../../../types';
import { hasWailsAppBindings } from '../../../utils/previewMode';
import { buildCPAAuthFileContentText } from '../model/accountCardActions';
import { decodeBase64Utf8, downloadTextFile, parseMaybeJSON } from '../model/accountConfig';
import {
  AccountDetailSection,
} from './AccountDetailPrimitives';
import type { AccountDetailLocalCliAction } from './AccountDetailSections';
import { getAccountsPreviewAuthFileContent } from '../previewData';

const inputClass =
  'w-full rounded-md border border-[var(--gt-border-default)] bg-[var(--gt-surface-canvas)] px-3 py-2 text-[length:var(--gt-font-size-sm)] text-[var(--gt-ink-primary)] outline-none transition-colors focus:border-[var(--gt-focus-ring)]';
const labelClass =
  'text-[length:var(--gt-font-size-xs)] font-normal text-[var(--gt-ink-muted)]';
const previewClass =
  'h-[52vh] min-h-[26rem] max-h-[34rem] overflow-auto rounded-md border border-[var(--gt-border-subtle)] bg-[var(--gt-surface-muted)] p-3 font-mono text-[length:var(--gt-font-size-xs)] leading-relaxed text-[var(--gt-ink-primary)] whitespace-pre-wrap break-all';

export function AuthFileSummarySection({
  account,
  localCliActions = [],
}: {
  account: AccountRecord;
  localCliActions?: ReadonlyArray<AccountDetailLocalCliAction>;
}) {
  const { trackRequest } = useDebug();
  const [rawContent, setRawContent] = useState('');
  const [cpaContent, setCpaContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [sanitizing, setSanitizing] = useState(false);
  const [normalizeError, setNormalizeError] = useState('');
  const [downloadState, setDownloadState] = useState<'idle' | 'success' | 'error'>('idle');

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

  useEffect(() => {
    if (!rawContent.trim()) {
      setCpaContent('');
      setNormalizeError('');
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const nextContent = await buildCPAContent(rawContent);
        if (!cancelled) {
          setCpaContent(nextContent);
          setNormalizeError('');
        }
      } catch {
        if (!cancelled) {
          setCpaContent('');
          setNormalizeError('CPA 文件规范化失败，下面显示原始 auth file 内容。');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [rawContent, trackRequest]);

  async function normalizeAuthFileContent(content: string) {
    if (!hasWailsAppBindings()) {
      const parsed = parseMaybeJSON(content);
      return typeof parsed === 'string' ? parsed : JSON.stringify(parsed, null, 2);
    }
    return trackRequest('NormalizeAuthFileContent', { content }, () => NormalizeAuthFileContent(content));
  }

  async function buildCPAContent(content: string) {
    const normalizedContent = await normalizeAuthFileContent(content);
    return buildCPAAuthFileContentText(normalizedContent);
  }

  async function handleDownloadCPA() {
    if (!rawContent.trim() || sanitizing) {
      return;
    }
    setSanitizing(true);
    setDownloadState('idle');
    try {
      const content = cpaContent || await buildCPAContent(rawContent);
      setCpaContent(content);
      downloadTextFile(resolveCPAFilename(account), content);
      setDownloadState('success');
      setTimeout(() => setDownloadState('idle'), 2000);
    } catch {
      setDownloadState('error');
      setNormalizeError('CPA 文件生成失败，请检查 auth file 内容。');
    }
    setSanitizing(false);
  }

  const displayed = cpaContent || rawContent;

  return (
    <AccountDetailSection
      componentName="AuthFileSummarySection"
      actions={
        <>
          <Button
            data-auth-file-config-action="download-cpa"
            onClick={handleDownloadCPA}
            loading={sanitizing}
            disabled={!rawContent.trim() || loading || sanitizing}
          >
            {downloadState === 'success' ? '已下载' : downloadState === 'error' ? '失败' : '下载 CPA 文件'}
          </Button>
          {localCliActions.map((action) => (
            <Tooltip key={action.id} title={action.disabledReason || action.detail || action.label}>
              <Button
                data-auth-file-config-local-cli-action={action.id}
                htmlType="button"
                disabled={action.disabled}
                onClick={() => {
                  if (!action.disabled) {
                    action.onSelect();
                  }
                }}
              >
                {action.label}
              </Button>
            </Tooltip>
          ))}
        </>
      }
    >
      <div className="grid gap-4 rounded-lg border border-[var(--gt-border-subtle)] bg-[var(--gt-surface-canvas)] p-4 shadow-sm">
        <div data-auth-file-config-management="quiet" className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2 min-w-0">
            <label className="grid gap-1.5">
              <span className={labelClass}>账号名称</span>
              <Input className={inputClass} value={account.displayName} readOnly />
            </label>
          </div>
          <div className="space-y-2 min-w-0">
            <label className="grid gap-1.5">
              <span className={labelClass}>CPA 文件名</span>
              <Input className={inputClass} value={resolveCPAFilename(account)} readOnly />
            </label>
          </div>
        </div>
        <div className="grid gap-2">
          <div className={labelClass}>CPA 文件预览</div>
          {loading ? (
            <div className="space-y-2">
              <div className="h-4 w-3/4 bg-[var(--gt-border-strong)]" />
              <div className="h-4 w-1/2 bg-[var(--gt-border-strong)]" />
            </div>
          ) : (
            <pre data-auth-file-config-preview="cpa-json" className={previewClass}>
              {displayed || '暂无配置数据'}
            </pre>
          )}
          {normalizeError ? (
            <div className="text-[length:var(--gt-font-size-xs)] text-[var(--gt-status-warning)]">
              {normalizeError}
            </div>
          ) : null}
        </div>
      </div>
    </AccountDetailSection>
  );
}

function resolveCPAFilename(account: AccountRecord) {
  const sourceName = String(account.name || account.displayName || account.id || 'codex-auth').trim() || 'codex-auth';
  return sourceName.toLowerCase().endsWith('.json') ? sourceName : `${sourceName}.json`;
}
