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
            className={`group grid min-h-[8rem] gap-3 border-2 p-3 text-left transition-transform active:scale-[0.99] ${
              selected
                ? 'border-[var(--gt-accent-primary)] bg-[color-mix(in_srgb,var(--gt-accent-primary)_8%,var(--bg-main))]'
                : 'border-[color:color-mix(in_srgb,var(--border-color)_55%,transparent)] bg-[var(--bg-main)] hover:-translate-y-0.5 hover:border-[var(--border-color)]'
            }`}
          >
            <div className="flex items-center justify-between gap-3">
              <span className="font-black uppercase italic tracking-normal text-[var(--text-primary)]">
                {definition.label}
              </span>
              <span className="border border-[var(--border-color)] px-2 py-0.5 font-mono text-[length:var(--font-size-ui-2xs)] font-black uppercase text-[var(--text-muted)]">
                {selected ? 'ACTIVE' : definition.rootAttribute}
              </span>
            </div>
            <div className="grid grid-cols-4 overflow-hidden border border-[var(--border-color)]">
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
            <p className="text-[length:var(--font-size-ui-xs)] font-bold leading-relaxed text-[var(--text-muted)]">
              {definition.description}
            </p>
          </button>
        );
      })}
    </div>
  );
}
