import { useEffect, useMemo, useState } from 'react';
import { useDebug } from '../../../context/useDebug';
import type { QuotaUsageCalibration } from '../../../types';
import { buildQuotaCalibrationInput, isQuotaCalibrationActive, type QuotaCalibrationMode } from '../model/quotaCalibration';
import type { QuotaWindowDisplay } from '../model/types';
import useQuotaCalibrations from '../hooks/useQuotaCalibrations';
import {
  AccountDetailPill,
} from './AccountDetailPrimitives';

interface QuotaCalibrationPanelProps {
  accountKey: string;
  windows: QuotaWindowDisplay[];
}

export function QuotaCalibrationPanel({ accountKey, windows }: QuotaCalibrationPanelProps) {
  const { trackRequest } = useDebug();
  const {
    quotaCalibrationsByAccountKey,
    loadQuotaCalibrations,
    addQuotaCalibration,
    revokeQuotaCalibration,
  } = useQuotaCalibrations(trackRequest);

  const [formOpen, setFormOpen] = useState(false);
  const [mode, setMode] = useState<QuotaCalibrationMode>('delta');
  const [value, setValue] = useState('');
  const [windowKey, setWindowKey] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const calibrations = quotaCalibrationsByAccountKey[accountKey] ?? [];
  const activeCalibrations = useMemo(
    () => calibrations.filter((c) => isQuotaCalibrationActive(c)),
    [calibrations],
  );
  const historicalCalibrations = useMemo(
    () => calibrations.filter((c) => !isQuotaCalibrationActive(c)).slice(0, 8),
    [calibrations],
  );

  useEffect(() => {
    if (!accountKey) return;
    let cancelled = false;
    void (async () => {
      const items = await loadQuotaCalibrations(accountKey);
      if (!cancelled && items.length > 0 && !windowKey) {
        setWindowKey(items[0].windowKey || '');
      }
    })();
    return () => { cancelled = true; };
  }, [accountKey, loadQuotaCalibrations]);

  useEffect(() => {
    if (windows.length > 0 && !windowKey) {
      setWindowKey(windows[0].id);
    }
  }, [windows, windowKey]);

  const windowOptions = useMemo(
    () => windows.map((w) => ({ id: w.id, label: w.label })),
    [windows],
  );

  async function handleSubmit() {
    const parsedValue = Number(value);
    if (!Number.isFinite(parsedValue) || parsedValue === 0) {
      setError('请输入有效数值');
      return;
    }
    if (!windowKey.trim()) {
      setError('请选择窗口');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      await addQuotaCalibration(buildQuotaCalibrationInput({
        accountKey,
        windowKey: windowKey.trim(),
        metric: 'tokens',
        mode,
        value: parsedValue,
      }));
      setFormOpen(false);
      setValue('');
    } catch (err: any) {
      setError(err?.message || '操作失败');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRevoke(id: string) {
    try {
      await revokeQuotaCalibration(id, accountKey);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '撤销失败');
    }
  }

  return (
    <div data-account-quota-calibration-panel="true" className="grid gap-2 border-2 border-[var(--border-color)] bg-[var(--bg-surface)] p-3">
      <div className="flex min-w-0 items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="font-mono text-[length:var(--font-size-ui-2xs)] font-black uppercase tracking-[0.18em] text-[var(--text-muted)]">
            CALIBRATION
          </div>
          {activeCalibrations.length > 0 ? (
            <div className="mt-1 text-[length:var(--font-size-ui-xs)] font-black text-[var(--text-primary)]">
              {activeCalibrations.length} 个活跃校准
            </div>
          ) : null}
        </div>
        <AccountDetailPill tone={activeCalibrations.length > 0 ? 'success' : 'neutral'}>
          {activeCalibrations.length > 0 ? 'ACTIVE' : 'NONE'}
        </AccountDetailPill>
      </div>

      {activeCalibrations.length > 0 ? (
        <div className="grid gap-1.5">
          {activeCalibrations.map((cal) => (
            <div
              key={cal.id}
              data-quota-calibration-item="active"
              className="flex min-w-0 items-center justify-between gap-2 border border-[var(--border-color)] bg-[var(--bg-main)] px-2 py-1.5"
            >
              <div className="min-w-0 flex-1">
                <div className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5">
                  <AccountDetailPill tone={cal.mode === 'delta' ? 'warning' : 'success'} className="!min-h-0 !px-1.5 !py-0 !text-[length:var(--font-size-ui-2xs)]">
                    {cal.mode === 'delta' ? 'DELTA' : 'SET'}
                  </AccountDetailPill>
                  <span className="font-mono text-[length:var(--font-size-ui-xs)] font-black tabular-nums text-[var(--text-primary)]">
                    {cal.mode === 'delta' ? (cal.value >= 0 ? '+' : '') : ''}{cal.value}
                  </span>
                  <span className="font-mono text-[length:var(--font-size-ui-2xs)] font-black uppercase text-[var(--text-muted)]">
                    {cal.windowKey}
                  </span>
                </div>
                {cal.expiresAt ? (
                  <div className="mt-0.5 font-mono text-[length:var(--font-size-ui-2xs)] text-[var(--text-muted)]">
                    created {formatCalibrationTime(cal.createdAt)} · expires {formatCalibrationTime(cal.expiresAt)}
                  </div>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => cal.id && handleRevoke(cal.id)}
                className="btn-swiss !min-h-0 !px-1.5 !py-0.5 !text-[length:var(--font-size-ui-2xs)]"
                title="撤销校准"
              >
                撤销
              </button>
            </div>
          ))}
        </div>
      ) : (
        !formOpen ? (
          <div className="text-[length:var(--font-size-ui-2xs)] text-[var(--text-muted)]">
            暂无活跃校准，可手动调整额度显示值
          </div>
        ) : null
      )}

      {historicalCalibrations.length > 0 ? (
        <div data-quota-calibration-history="true" className="grid gap-1 border-t border-[var(--border-color)] pt-2">
          <div className="font-mono text-[length:var(--font-size-ui-2xs)] font-black uppercase tracking-[0.16em] text-[var(--text-muted)]">
            校准历史 / Audit
          </div>
          {historicalCalibrations.map((cal) => (
            <div key={cal.id} className="flex min-w-0 items-center justify-between gap-2 text-[length:var(--font-size-ui-2xs)] text-[var(--text-muted)]">
              <span className="min-w-0 truncate font-mono">
                {cal.windowKey} · {cal.mode} · {cal.value}
              </span>
              <span className="shrink-0 font-mono">
                {cal.revokedAt ? `revoked ${formatCalibrationTime(cal.revokedAt)}` : `expired ${formatCalibrationTime(cal.expiresAt)}`}
              </span>
            </div>
          ))}
        </div>
      ) : null}

      {formOpen ? (
        <div data-quota-calibration-form="true" className="grid gap-2 border-t border-[var(--border-color)] pt-2">
          <div className="grid grid-cols-3 gap-2">
            <label className="grid gap-1">
              <span className="font-mono text-[length:var(--font-size-ui-2xs)] font-black uppercase tracking-[0.12em] text-[var(--text-muted)]">
                模式
              </span>
              <select
                value={mode}
                onChange={(e) => setMode(e.target.value as QuotaCalibrationMode)}
                className="input-swiss font-mono !text-[length:var(--font-size-ui-xs)] !py-1"
              >
                <option value="delta">Delta (差值)</option>
                <option value="set-effective">Set (设定值)</option>
              </select>
            </label>
            <label className="grid gap-1">
              <span className="font-mono text-[length:var(--font-size-ui-2xs)] font-black uppercase tracking-[0.12em] text-[var(--text-muted)]">
                数值
              </span>
              <input
                type="number"
                value={value}
                onChange={(e) => { setValue(e.target.value); setError(''); }}
                placeholder={mode === 'delta' ? '±1200' : '50000'}
                className="input-swiss font-mono !text-[length:var(--font-size-ui-xs)] !py-1"
              />
            </label>
            <label className="grid gap-1">
              <span className="font-mono text-[length:var(--font-size-ui-2xs)] font-black uppercase tracking-[0.12em] text-[var(--text-muted)]">
                窗口
              </span>
              <select
                value={windowKey}
                onChange={(e) => setWindowKey(e.target.value)}
                className="input-swiss font-mono !text-[length:var(--font-size-ui-xs)] !py-1"
              >
                {windowOptions.length > 0 ? (
                  windowOptions.map((w) => (
                    <option key={w.id} value={w.id}>{w.label}</option>
                  ))
                ) : (
                  <option value="">无窗口数据</option>
                )}
              </select>
            </label>
          </div>
          {error ? (
            <div className="font-mono text-[length:var(--font-size-ui-2xs)] text-[var(--color-status-danger)]">
              {error}
            </div>
          ) : null}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void handleSubmit()}
              disabled={submitting || !value.trim()}
              className="btn-swiss !text-[length:var(--font-size-ui-2xs)]"
            >
              {submitting ? '提交中...' : '确认添加'}
            </button>
            <button
              type="button"
              onClick={() => { setFormOpen(false); setValue(''); setError(''); }}
              disabled={submitting}
              className="btn-swiss !text-[length:var(--font-size-ui-2xs)]"
            >
              取消
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setFormOpen(true)}
          className="btn-swiss !text-[length:var(--font-size-ui-2xs)]"
        >
          添加校准
        </button>
      )}
    </div>
  );
}

function formatCalibrationTime(value?: string) {
  if (!value) return '-';
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return value;
  return new Date(parsed).toLocaleString();
}
