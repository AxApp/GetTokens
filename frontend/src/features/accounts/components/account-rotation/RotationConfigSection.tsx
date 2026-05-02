import { useMemo, type RefObject } from 'react';
import { useI18n } from '../../../../context/I18nContext';
import type { main } from '../../../../../wailsjs/go/models';

interface RotationConfigSectionProps {
  routingDraft: main.RelayRoutingConfig;
  setRoutingDraft: (updater: (prev: main.RelayRoutingConfig | null) => main.RelayRoutingConfig | null) => void;
  isStrategyMenuOpen: boolean;
  setIsStrategyMenuOpen: (open: boolean | ((prev: boolean) => boolean)) => void;
  strategyMenuRef: RefObject<HTMLDivElement>;
}

export function RotationConfigSection({
  routingDraft,
  setRoutingDraft,
  isStrategyMenuOpen,
  setIsStrategyMenuOpen,
  strategyMenuRef,
}: RotationConfigSectionProps) {
  const { t } = useI18n();

  const routingToggleFields = useMemo(
    () =>
      [
        ['sessionAffinity', t('status.routing_session_affinity')],
        ['switchProject', t('status.routing_switch_project')],
        ['switchPreviewModel', t('status.routing_switch_preview_model')],
        ['antigravityCredits', t('status.routing_antigravity_credits')],
      ] as const,
    [t]
  );

  const routingStrategyOptions = useMemo(
    () => [
      { value: 'round-robin', label: t('status.routing_strategy_round_robin') },
      { value: 'fill-first', label: t('status.routing_strategy_fill_first') },
    ],
    [t]
  );

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        <label className="space-y-2 border-2 border-[var(--border-color)] bg-[var(--bg-surface)] p-4">
          <span className="text-[0.5625rem] font-black uppercase tracking-[0.18em] text-[var(--text-muted)]">
            {t('status.routing_strategy')}
          </span>
          <div ref={strategyMenuRef} className="relative">
            <button
              type="button"
              onClick={() => setIsStrategyMenuOpen((prev) => !prev)}
              className="select-swiss flex items-center justify-between gap-3 text-left"
              aria-haspopup="listbox"
              aria-expanded={isStrategyMenuOpen}
            >
              <span>
                {routingStrategyOptions.find((option) => option.value === routingDraft.strategy)?.label ||
                  routingDraft.strategy}
              </span>
              <span className="shrink-0 text-[0.625rem] font-black uppercase tracking-[0.2em] text-[var(--text-primary)]">
                ▼
              </span>
            </button>
            {isStrategyMenuOpen ? (
              <div
                className="absolute left-0 right-0 top-[calc(100%+0.5rem)] z-20 border-2 border-[var(--border-color)] bg-[var(--bg-main)] p-2 shadow-[6px_6px_0_var(--shadow-color)]"
                role="listbox"
              >
                <div className="space-y-2">
                  {routingStrategyOptions.map((option) => {
                    const isSelected = routingDraft.strategy === option.value;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => {
                          setRoutingDraft((prev) => (prev ? { ...prev, strategy: option.value } : prev));
                          setIsStrategyMenuOpen(false);
                        }}
                        className={`flex w-full items-center justify-between border-2 px-3 py-2 text-left text-[0.625rem] font-black uppercase tracking-[0.12em] transition-transform ${
                          isSelected
                            ? 'border-[var(--text-primary)] bg-[var(--bg-surface)] text-[var(--text-primary)]'
                            : 'border-[var(--border-color)] bg-[var(--bg-main)] text-[var(--text-muted)] hover:translate-x-[-1px] hover:translate-y-[-1px]'
                        }`}
                        role="option"
                        aria-selected={isSelected}
                      >
                        <span>{option.label}</span>
                        {isSelected ? <span className="text-[0.5rem] tracking-[0.18em]">ACTIVE</span> : null}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}
          </div>
        </label>

        <label className="space-y-2 border-2 border-[var(--border-color)] bg-[var(--bg-surface)] p-4">
          <span className="text-[0.5625rem] font-black uppercase tracking-[0.18em] text-[var(--text-muted)]">
            {t('status.routing_session_affinity_ttl')}
          </span>
          <div className="border-2 border-[var(--border-color)] bg-[var(--bg-main)] p-1.5">
            <input
              value={routingDraft.sessionAffinityTTL}
              onChange={(event) =>
                setRoutingDraft((prev) => (prev ? { ...prev, sessionAffinityTTL: event.target.value } : prev))
              }
              className="w-full border-0 bg-transparent px-1 py-1 font-mono text-[0.75rem] font-black uppercase tracking-[0.08em] text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)]/80"
              placeholder="1h"
            />
          </div>
        </label>

        <label className="space-y-2 border-2 border-[var(--border-color)] bg-[var(--bg-surface)] p-4">
          <span className="text-[0.5625rem] font-black uppercase tracking-[0.18em] text-[var(--text-muted)]">
            {t('status.routing_request_retry')}
          </span>
          <div className="flex items-center gap-2 border-2 border-[var(--border-color)] bg-[var(--bg-main)] p-1.5">
            <input
              value={String(routingDraft.requestRetry)}
              onChange={(event) =>
                setRoutingDraft((prev) =>
                  prev ? { ...prev, requestRetry: Number.parseInt(event.target.value || '0', 10) || 0 } : prev
                )
              }
              className="w-full border-0 bg-transparent px-1 py-1 font-mono text-[0.75rem] font-black uppercase tracking-[0.08em] text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)]/80"
              inputMode="numeric"
              placeholder="2"
            />
            <span className="shrink-0 border-l-2 border-[var(--border-color)] pl-2 text-[0.5rem] font-black uppercase tracking-[0.18em] text-[var(--text-muted)]">
              req
            </span>
          </div>
        </label>

        <label className="space-y-2 border-2 border-[var(--border-color)] bg-[var(--bg-surface)] p-4">
          <span className="text-[0.5625rem] font-black uppercase tracking-[0.18em] text-[var(--text-muted)]">
            {t('status.routing_max_retry_credentials')}
          </span>
          <div className="flex items-center gap-2 border-2 border-[var(--border-color)] bg-[var(--bg-main)] p-1.5">
            <input
              value={String(routingDraft.maxRetryCredentials)}
              onChange={(event) =>
                setRoutingDraft((prev) =>
                  prev
                    ? {
                        ...prev,
                        maxRetryCredentials: Number.parseInt(event.target.value || '0', 10) || 0,
                      }
                    : prev
                )
              }
              className="w-full border-0 bg-transparent px-1 py-1 font-mono text-[0.75rem] font-black uppercase tracking-[0.08em] text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)]/80"
              inputMode="numeric"
              placeholder="3"
            />
            <span className="shrink-0 border-l-2 border-[var(--border-color)] pl-2 text-[0.5rem] font-black uppercase tracking-[0.18em] text-[var(--text-muted)]">
              keys
            </span>
          </div>
        </label>

        <label className="space-y-2 border-2 border-[var(--border-color)] bg-[var(--bg-surface)] p-4 md:col-span-2 xl:col-span-1">
          <span className="text-[0.5625rem] font-black uppercase tracking-[0.18em] text-[var(--text-muted)]">
            {t('status.routing_max_retry_interval')}
          </span>
          <div className="flex items-center gap-2 border-2 border-[var(--border-color)] bg-[var(--bg-main)] p-1.5">
            <input
              value={String(routingDraft.maxRetryInterval)}
              onChange={(event) =>
                setRoutingDraft((prev) =>
                  prev ? { ...prev, maxRetryInterval: Number.parseInt(event.target.value || '0', 10) || 0 } : prev
                )
              }
              className="w-full border-0 bg-transparent px-1 py-1 font-mono text-[0.75rem] font-black uppercase tracking-[0.08em] text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)]/80"
              inputMode="numeric"
              placeholder="30"
            />
            <span className="shrink-0 border-l-2 border-[var(--border-color)] pl-2 text-[0.5rem] font-black uppercase tracking-[0.18em] text-[var(--text-muted)]">
              sec
            </span>
          </div>
        </label>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        {routingToggleFields.map(([field, label]) => (
          <label
            key={field}
            className="flex min-h-[76px] items-center justify-between gap-4 border-2 border-[var(--border-color)] bg-[var(--bg-surface)] p-4"
          >
            <div className="space-y-1">
              <span className="block text-[0.5rem] font-black uppercase tracking-[0.18em] text-[var(--text-muted)]">
                {t('common.status')}
              </span>
              <span className="block text-[0.625rem] font-black uppercase tracking-wide text-[var(--text-primary)]">
                {label}
              </span>
            </div>
            <input
              type="checkbox"
              checked={Boolean(routingDraft[field as keyof main.RelayRoutingConfig])}
              onChange={(event) =>
                setRoutingDraft((prev) =>
                  prev ? { ...prev, [field]: event.target.checked } : prev
                )
              }
              className="h-4 w-4 shrink-0 accent-[var(--text-primary)]"
            />
          </label>
        ))}
      </div>
    </div>
  );
}
