import type { ThemePreset } from '../../types';
import { themePresetDefinitions } from '../../context/theme';

interface ThemePresetPickerProps {
  value: ThemePreset;
  onChange: (value: ThemePreset) => void;
  size?: 'compact' | 'full';
}

export function ThemePresetPicker({
  value,
  onChange,
  size = 'full',
}: ThemePresetPickerProps) {
  return (
    <div
      className={
        size === 'full'
          ? 'grid gap-3 md:grid-cols-2'
          : 'flex gap-2'
      }
    >
      {themePresetDefinitions.map((definition) => {
        const selected = definition.id === value;
        return (
          <button
            key={definition.id}
            type="button"
            aria-pressed={selected}
            data-theme-preset-option={definition.id}
            onClick={() => onChange(definition.id)}
            className={`group grid min-h-[8rem] gap-3 border border-[var(--gt-border-subtle)] bg-[var(--gt-surface-canvas)] p-3 text-left transition-transform active:scale-[0.99] ${
              selected
                ? 'border-[var(--gt-accent-primary)] bg-[color-mix(in_srgb,var(--gt-accent-primary)_8%,var(--gt-surface-canvas))]'
                : 'hover:-translate-y-0.5 hover:border-[var(--gt-border-strong)] hover:bg-[var(--gt-surface-muted)]'
            }`}
          >
            <div className="flex items-center justify-between gap-3">
              <span className="font-semibold italic text-[var(--gt-ink-primary)]">
                {definition.label}
              </span>
              <span className="rounded-sm border border-[var(--gt-border-subtle)] bg-[var(--gt-surface-muted)] px-2 py-0.5 font-mono text-[length:var(--font-size-ui-2xs)] font-medium text-[var(--gt-ink-muted)]">
                {selected ? 'ACTIVE' : definition.rootAttribute}
              </span>
            </div>
            <div className="grid grid-cols-4 overflow-hidden border border-[var(--gt-border-subtle)]">
              <span
                className="h-8"
                style={{ backgroundColor: definition.previewTokens.canvas }}
              />
              <span
                className="h-8"
                style={{ backgroundColor: definition.previewTokens.panel }}
              />
              <span
                className="h-8"
                style={{ backgroundColor: definition.previewTokens.ink }}
              />
              <span
                className="h-8"
                style={{ backgroundColor: definition.previewTokens.accent }}
              />
            </div>
            <p className="text-[length:var(--font-size-ui-xs)] font-medium leading-relaxed text-[var(--gt-ink-muted)]">
              {definition.description}
            </p>
          </button>
        );
      })}
    </div>
  );
}
