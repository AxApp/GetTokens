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

const rotationConfigPanelClass = 'rounded border border-[var(--gt-border-subtle)] bg-[var(--gt-surface-muted)] p-4';
const rotationConfigInputShellClass = 'flex items-center gap-2 rounded border border-[var(--gt-border-subtle)] bg-[var(--gt-surface-canvas)] p-1.5';
const rotationConfigInputClass =
  'w-full border-0 bg-transparent px-1 py-1 font-mono text-[length:var(--gt-font-size-md)] font-normal tracking-normal text-[var(--gt-ink-primary)] outline-none placeholder:text-[var(--gt-ink-muted)]/80';
const rotationConfigMetaClass = 'text-[length:var(--gt-font-size-xs)] font-normal tracking-normal text-[var(--gt-ink-muted)]';
const rotationConfigUnitClass = 'shrink-0 border-l border-[var(--gt-border-subtle)] pl-2 text-[length:var(--gt-font-size-2xs)] font-normal tracking-normal text-[var(--gt-ink-muted)]';
const rotationConfigToggleClass = 'h-4 w-4 shrink-0 accent-[var(--gt-status-warning)]';

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
    <div data-account-rotation-config-section="true" className="space-y-6">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        <label className={`space-y-2 ${rotationConfigPanelClass}`}>
          <span className={rotationConfigMetaClass}>
            {t('status.routing_strategy')}
          </span>
          <div ref={strategyMenuRef} className="relative">
            <button
              type="button"
              onClick={() => setIsStrategyMenuOpen((prev) => !prev)}
              className="flex min-h-10 w-full items-center justify-between gap-3 rounded border border-[var(--gt-border-subtle)] bg-[var(--gt-surface-canvas)] px-3 py-2 text-left text-[length:var(--gt-font-size-sm)] font-normal text-[var(--gt-ink-primary)] transition hover:border-[var(--gt-border-strong)] hover:bg-[var(--gt-surface-muted)]"
              aria-haspopup="listbox"
              aria-expanded={isStrategyMenuOpen}
            >
              <span>
                {routingStrategyOptions.find((option) => option.value === routingDraft.strategy)?.label ||
                  routingDraft.strategy}
              </span>
              <span className="shrink-0 text-[length:var(--gt-font-size-sm)] font-semibold tracking-normal text-[var(--gt-ink-primary)]">
                ▼
              </span>
            </button>
            {isStrategyMenuOpen ? (
              <div
                data-account-rotation-strategy-menu="true"
                className="absolute left-0 right-0 top-[calc(100%+0.5rem)] z-20 rounded border border-[var(--gt-border-subtle)] bg-[var(--gt-surface-canvas)] p-2 shadow-sm"
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
                        className={`flex w-full items-center justify-between rounded border px-3 py-2 text-left text-[length:var(--gt-font-size-sm)] font-normal tracking-normal transition ${
                          isSelected
                            ? 'border-[var(--gt-border-strong)] bg-[var(--gt-surface-muted)] text-[var(--gt-ink-primary)]'
                            : 'border-[var(--gt-border-subtle)] bg-[var(--gt-surface-canvas)] text-[var(--gt-ink-muted)] hover:bg-[var(--gt-surface-muted)]'
                        }`}
                        role="option"
                        aria-selected={isSelected}
                      >
                        <span>{option.label}</span>
                        {isSelected ? <span className="text-[length:var(--gt-font-size-2xs)] font-normal tracking-normal">ACTIVE</span> : null}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}
          </div>
        </label>

        <label className={`space-y-2 ${rotationConfigPanelClass}`}>
          <span className={rotationConfigMetaClass}>
            {t('status.routing_session_affinity_ttl')}
          </span>
          <div className={rotationConfigInputShellClass}>
            <input
              value={routingDraft.sessionAffinityTTL}
              onChange={(event) =>
                setRoutingDraft((prev) => (prev ? { ...prev, sessionAffinityTTL: event.target.value } : prev))
              }
              className={rotationConfigInputClass}
              placeholder="1h"
            />
          </div>
        </label>

        <label className={`space-y-2 ${rotationConfigPanelClass}`}>
          <span className={rotationConfigMetaClass}>
            {t('status.routing_request_retry')}
          </span>
          <div className={rotationConfigInputShellClass}>
            <input
              value={String(routingDraft.requestRetry)}
              onChange={(event) =>
                setRoutingDraft((prev) =>
                  prev ? { ...prev, requestRetry: Number.parseInt(event.target.value || '0', 10) || 0 } : prev
                )
              }
              className={rotationConfigInputClass}
              inputMode="numeric"
              placeholder="2"
            />
            <span className={rotationConfigUnitClass}>
              req
            </span>
          </div>
        </label>

        <label className={`space-y-2 ${rotationConfigPanelClass}`}>
          <span className={rotationConfigMetaClass}>
            {t('status.routing_max_retry_credentials')}
          </span>
          <div className={rotationConfigInputShellClass}>
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
              className={rotationConfigInputClass}
              inputMode="numeric"
              placeholder="3"
            />
            <span className={rotationConfigUnitClass}>
              keys
            </span>
          </div>
        </label>

        <label className={`space-y-2 md:col-span-2 xl:col-span-1 ${rotationConfigPanelClass}`}>
          <span className={rotationConfigMetaClass}>
            {t('status.routing_max_retry_interval')}
          </span>
          <div className={rotationConfigInputShellClass}>
            <input
              value={String(routingDraft.maxRetryInterval)}
              onChange={(event) =>
                setRoutingDraft((prev) =>
                  prev ? { ...prev, maxRetryInterval: Number.parseInt(event.target.value || '0', 10) || 0 } : prev
                )
              }
              className={rotationConfigInputClass}
              inputMode="numeric"
              placeholder="30"
            />
            <span className={rotationConfigUnitClass}>
              sec
            </span>
          </div>
        </label>
      </div>

      <div data-account-rotation-toggle-grid="true" className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        {routingToggleFields.map(([field, label]) => (
          <label
            key={field}
            className="flex min-h-[76px] items-center justify-between gap-4 rounded border border-[var(--gt-border-subtle)] bg-[var(--gt-surface-muted)] p-4"
          >
            <div className="space-y-1">
              <span className="block text-[length:var(--gt-font-size-2xs)] font-normal tracking-normal text-[var(--gt-ink-muted)]">
                {t('common.status')}
              </span>
              <span className="block text-[length:var(--gt-font-size-sm)] font-semibold tracking-normal text-[var(--gt-ink-primary)]">
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
              className={rotationConfigToggleClass}
            />
          </label>
        ))}
      </div>
    </div>
  );
}
