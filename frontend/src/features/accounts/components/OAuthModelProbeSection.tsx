import { useEffect, useMemo, useState } from 'react';
import { Button } from 'antd';
import { Combobox } from '../../../components/ui/Combobox.tsx';
import { normalizeAPIKeyModelNames } from '../model/apiKeyModelCatalog';
import {
  AccountDetailPill,
  AccountDetailSection,
} from './AccountDetailPrimitives';

const oauthModelProbeFieldLabelClass =
  'text-[length:var(--gt-font-size-xs)] font-normal tracking-normal text-[var(--gt-ink-muted)]';
const oauthModelProbeStatusClass =
  'rounded-md border border-[var(--gt-border-subtle)] bg-[var(--gt-surface-muted)] px-3 py-2 text-[length:var(--gt-font-size-sm)] font-normal leading-snug text-[var(--gt-ink-muted)]';

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
  }, [accountID, defaultModel, options, probeState?.model]);

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
    : probeState?.message || '';

  return (
    <AccountDetailSection
      componentName="OAuthModelProbeSection"
      eyebrow="Model Probe"
      title="模型测试"
      meta={accountLabel}
      bandActionDivider={false}
      actions={<AccountDetailPill tone={statusTone}>{statusLabel}</AccountDetailPill>}
    >
      <div data-oauth-model-probe-shell="quiet" data-oauth-model-probe-account={accountID} className="grid gap-3 rounded-lg border border-[var(--gt-border-subtle)] bg-[var(--gt-surface-canvas)] p-4 shadow-sm">
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
              className="w-full"
              popupMatchSelectWidth={false}
              popupClassName="gettokens-oauth-model-probe-combobox-popup"
              onChange={setModel}
            />
          </label>
          <Button
            size="small"
            onClick={() => onProbe?.(selectedModel)}
            disabled={!canProbe}
            data-oauth-model-probe-button="run"
          >
            {running ? '测试中...' : '测试'}
          </Button>
        </div>
        {message ? (
          <div
            data-oauth-model-probe-status={currentStatus}
            className={oauthModelProbeStatusClass}
          >
            {message}
          </div>
        ) : null}
      </div>
    </AccountDetailSection>
  );
}
