import { ChevronDown } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';

export function ModelCombobox({
  value,
  options,
  placeholder,
  align = 'left',
  onChange,
}: {
  value: string;
  options: string[];
  placeholder: string;
  align?: 'left' | 'right';
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [menuMode, setMenuMode] = useState<'browse' | 'filter'>('browse');
  const rootRef = useRef<HTMLDivElement | null>(null);
  const normalizedValue = value.trim().toLowerCase();
  const visibleOptions = useMemo(() => {
    const seen = new Set<string>();
    const filtered: string[] = [];
    for (const option of options || []) {
      const name = String(option || '').trim();
      const key = name.toLowerCase();
      if (!name || seen.has(key)) {
        continue;
      }
      if (menuMode === 'filter' && normalizedValue && !key.includes(normalizedValue)) {
        continue;
      }
      seen.add(key);
      filtered.push(name);
      if (filtered.length >= 8) {
        break;
      }
    }
    return filtered;
  }, [menuMode, normalizedValue, options]);
  const canOpen = visibleOptions.length > 0;

  useEffect(() => {
    if (!open) {
      return;
    }
    const closeOnOutsidePointer = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('pointerdown', closeOnOutsidePointer);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsidePointer);
    };
  }, [open]);

  function selectOption(option: string) {
    onChange(option);
    setOpen(false);
  }

  return (
    <div ref={rootRef} className="relative min-w-0">
      <input
        value={value}
        onChange={(event) => {
          onChange(event.target.value);
          setMenuMode('filter');
          setOpen(true);
        }}
        onFocus={() => {
          if (canOpen) {
            setMenuMode('browse');
            setOpen(true);
          }
        }}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            setOpen(false);
          }
          if (event.key === 'ArrowDown' && canOpen) {
            event.preventDefault();
            setMenuMode('browse');
            setOpen(true);
          }
        }}
        className={`input-swiss w-full min-w-0 font-mono !px-2 !py-1.5 !pr-8 !text-[0.625rem] ${
          align === 'right' ? 'text-right' : ''
        }`}
        placeholder={placeholder}
        aria-label={placeholder}
        role="combobox"
        aria-expanded={open && canOpen}
        aria-autocomplete="list"
      />
      <button
        type="button"
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => {
          if (canOpen) {
            setMenuMode('browse');
            setOpen((current) => !current);
          }
        }}
        disabled={!canOpen}
        className="absolute right-1 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center border-l border-[var(--border-color)] bg-[var(--bg-main)] text-[var(--text-muted)] hover:bg-[var(--bg-surface)] hover:text-[var(--text-primary)] disabled:cursor-not-allowed disabled:opacity-35"
        aria-label="Select model"
      >
        <ChevronDown className="h-3.5 w-3.5" strokeWidth={4} />
      </button>
      {open && canOpen ? (
        <div
          className={`absolute top-[calc(100%+0.25rem)] z-50 max-h-56 w-max min-w-full max-w-[24rem] overflow-auto border-2 border-[var(--border-color)] bg-[var(--bg-main)] p-1.5 shadow-[4px_4px_0_var(--shadow-color)] ${
            align === 'right' ? 'right-0' : 'left-0'
          }`}
          role="listbox"
        >
          <div className="space-y-1">
            {visibleOptions.map((option) => {
              const selected = option === value;
              return (
                <button
                  key={option}
                  type="button"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => selectOption(option)}
                  className={`block w-full min-w-0 border-2 px-2.5 py-1.5 font-mono text-[0.625rem] font-bold normal-case tracking-normal transition-transform ${
                    align === 'right' ? 'text-right' : 'text-left'
                  } ${
                    selected
                      ? 'border-[var(--text-primary)] bg-[var(--bg-surface)] text-[var(--text-primary)]'
                      : 'border-[var(--border-color)] bg-[var(--bg-main)] text-[var(--text-muted)] hover:-translate-x-px hover:-translate-y-px hover:bg-[var(--bg-surface)] hover:text-[var(--text-primary)]'
                  }`}
                  role="option"
                  aria-selected={selected}
                  title={option}
                >
                  <span className="block min-w-0 truncate">{option}</span>
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
