import { Play } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Combobox } from '../../../components/ui/Combobox.tsx';
import { normalizeAPIKeyModelNames } from '../model/apiKeyModelCatalog';
import {
  AccountDetailEmptyState,
  AccountDetailPill,
  AccountDetailSection,
} from './AccountDetailPrimitives';

const oauthModelProbeFieldLabelClass =
  'text-[length:var(--font-size-ui-xs)] font-medium tracking-normal text-[var(--text-muted)]';
const oauthModelProbeButtonClass =
  'inline-flex min-h-10 items-center justify-center gap-2 rounded border border-[var(--gt-border-subtle)] bg-[var(--gt-surface-canvas)] px-3 py-2 text-[length:var(--font-size-ui-xs)] font-medium text-[var(--gt-ink-primary)] transition-colors hover:border-[var(--gt-border-strong)] hover:bg-[var(--gt-surface-muted)] disabled:cursor-not-allowed disabled:opacity-50';
const oauthModelProbeStatusBaseClass =
  'rounded border px-3 py-2 font-mono text-[length:var(--font-size-ui-xs)] font-medium leading-5 tracking-normal';
const oauthModelProbeStatusToneClassNames = {
  idle: 'border-[var(--gt-border-subtle)] bg-[var(--gt-surface-muted)] text-[var(--text-muted)]',
  loading:
    'border-[var(--gt-status-warning)] bg-[color-mix(in_srgb,var(--gt-status-warning)_10%,var(--gt-surface-canvas))] text-[var(--gt-status-warning)]',
  success:
    'border-[var(--gt-status-success)] bg-[color-mix(in_srgb,var(--gt-status-success)_10%,var(--gt-surface-canvas))] text-[var(--gt-status-success)]',
  error:
    'border-[var(--gt-status-danger)] bg-[color-mix(in_srgb,var(--gt-status-danger)_10%,var(--gt-surface-canvas))] text-[var(--gt-status-danger)]',
} satisfies Record<OAuthModelProbeState['status'], string>;

export type OAuthModelProbeState = {
  model: string;
  status: 'idle' | 'loading' | 'success' | 'error';
  message: string;
  lastTestedAt: number | null;
};

export function OAuthModelProbeSection({
  accountID,
  accountLabel,
  modelOptions = [],
  defaultModel = 'gpt-5.4-mini',
  disabled = false,
  disabledReason = '',
  probeState,
  onProbe,
}: {
  accountID: string;
  accountLabel: string;
  modelOptions?: string[];
  defaultModel?: string;
  disabled?: boolean;
  disabledReason?: string;
  probeState?: OAuthModelProbeState;
  onProbe?: (model: string) => void;
}) {
  const options = useMemo(
    () => normalizeAPIKeyModelNames([...modelOptions, defaultModel]),
    [defaultModel, modelOptions],
  );
  const [model, setModel] = useState(() => probeState?.model || options[0] || defaultModel);

  useEffect(() => {
    setModel(probeState?.model || options[0] || defaultModel);
  }, [accountID]);

  const currentStatus = probeState?.status || 'idle';
  const running = currentStatus === 'loading';
  const selectedModel = model.trim();
  const canProbe = !disabled && !running && Boolean(selectedModel) && Boolean(onProbe);
  const statusTone =
    currentStatus === 'success'
      ? 'success'
      : currentStatus === 'error'
        ? 'danger'
        : running
          ? 'warning'
          : 'neutral';
  const statusLabel =
    currentStatus === 'success'
      ? 'PASS'
      : currentStatus === 'error'
        ? 'FAIL'
        : running
          ? 'RUNNING'
          : 'READY';
  const message = disabled
    ? disabledReason || '当前账号不可执行模型测试'
    : probeState?.message || '只允许当前 OAuth 账号参与本次路由探测，fallback 已关闭。';

  return (
    <AccountDetailSection
      componentName="OAuthModelProbeSection"
      eyebrow="Model Probe"
      title="模型测试"
      meta={accountLabel}
      bandActionDivider={false}
      actions={<AccountDetailPill tone={statusTone}>{statusLabel}</AccountDetailPill>}
    >
      <div data-oauth-model-probe-shell="quiet" data-oauth-model-probe-account={accountID} className="grid gap-3">
        <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
          <label className="grid min-w-0 gap-1.5">
            <span className={oauthModelProbeFieldLabelClass}>
              测试模型
            </span>
            <Combobox
              value={model}
              options={options}
              placeholder={defaultModel}
              maxOptions={12}
              onChange={setModel}
            />
          </label>
          <button
            type="button"
            onClick={() => onProbe?.(selectedModel)}
            disabled={!canProbe}
            className={oauthModelProbeButtonClass}
            data-oauth-model-probe-button="run"
          >
            <Play className="h-3.5 w-3.5" strokeWidth={4} />
            {running ? '测试中' : '测试模型'}
          </button>
        </div>
        {message ? (
          <div
            data-oauth-model-probe-status={currentStatus}
            className={`${oauthModelProbeStatusBaseClass} ${oauthModelProbeStatusToneClassNames[currentStatus]}`}
          >
            {message}
          </div>
        ) : (
          <AccountDetailEmptyState>暂无测试结果</AccountDetailEmptyState>
        )}
      </div>
    </AccountDetailSection>
  );
}
