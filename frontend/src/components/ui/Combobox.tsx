import { ChevronDown } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

export interface ComboboxProps {
  value: string;
  options: string[];
  placeholder?: string;
  disabled?: boolean;
  align?: 'left' | 'right';
  maxOptions?: number;
  className?: string;
  onChange: (value: string) => void;
}

export function Combobox({
  value,
  options,
  placeholder = '',
  disabled = false,
  align = 'left',
  maxOptions,
  className = '',
  onChange,
}: ComboboxProps) {
  const [open, setOpen] = useState(false);
  const [menuMode, setMenuMode] = useState<'browse' | 'filter'>('browse');
  const rootRef = useRef<HTMLDivElement | null>(null);
  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});

  const normalizedValue = value.trim().toLowerCase();

  const visibleOptions = useMemo(() => {
    const seen = new Set<string>();
    const filtered: string[] = [];
    for (const option of options) {
      const name = String(option ?? '').trim();
      const key = name.toLowerCase();
      if (!name || seen.has(key)) continue;
      if (menuMode === 'filter' && normalizedValue && !key.includes(normalizedValue)) continue;
      seen.add(key);
      filtered.push(name);
      if (maxOptions !== undefined && filtered.length >= maxOptions) break;
    }
    return filtered;
  }, [menuMode, normalizedValue, options, maxOptions]);

  const canOpen = visibleOptions.length > 0 && !disabled;

  function recalcPosition() {
    if (!rootRef.current) return;
    const rect = rootRef.current.getBoundingClientRect();
    const GAP = 4;
    const MAX_HEIGHT = 224; // max-h-56 = 14rem = 224px
    const spaceBelow = window.innerHeight - rect.bottom - GAP;
    const spaceAbove = rect.top - GAP;
    const placeAbove = spaceBelow < MAX_HEIGHT && spaceAbove > spaceBelow;

    if (placeAbove) {
      const height = Math.min(MAX_HEIGHT, spaceAbove);
      setDropdownStyle({
        position: 'fixed',
        bottom: window.innerHeight - rect.top + GAP,
        maxHeight: height,
        ...(align === 'right'
          ? { right: window.innerWidth - rect.right }
          : { left: rect.left }),
        width: rect.width,
        minWidth: rect.width,
      });
    } else {
      const height = Math.min(MAX_HEIGHT, spaceBelow);
      setDropdownStyle({
        position: 'fixed',
        top: rect.bottom + GAP,
        maxHeight: height,
        ...(align === 'right'
          ? { right: window.innerWidth - rect.right }
          : { left: rect.left }),
        width: rect.width,
        minWidth: rect.width,
      });
    }
  }

  useEffect(() => {
    if (!open) return;
    recalcPosition();

    const onOutside = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!rootRef.current?.contains(target) && !dropdownRef.current?.contains(target)) {
        setOpen(false);
      }
    };
    document.addEventListener('pointerdown', onOutside);
    window.addEventListener('scroll', recalcPosition, true);
    window.addEventListener('resize', recalcPosition);
    return () => {
      document.removeEventListener('pointerdown', onOutside);
      window.removeEventListener('scroll', recalcPosition, true);
      window.removeEventListener('resize', recalcPosition);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, align]);

  function selectOption(option: string) {
    onChange(option);
    setOpen(false);
  }

  const dropdown =
    open && canOpen ? (
      <div
        ref={dropdownRef}
        style={dropdownStyle}
        className={`z-[9999] overflow-auto border-2 border-[var(--border-color)] bg-[var(--bg-main)] p-1.5 shadow-[4px_4px_0_var(--shadow-color)]`}
        role="listbox"
      >
        <div className="space-y-1">
          {visibleOptions.map((option) => (
            <button
              key={option}
              type="button"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => selectOption(option)}
              role="option"
              aria-selected={option === value}
              title={option}
              className={`block w-full min-w-0 border-2 px-2.5 py-1.5 font-mono text-[length:var(--font-size-ui-sm)] font-bold normal-case tracking-normal transition-transform ${
                align === 'right' ? 'text-right' : 'text-left'
              } ${
                option === value
                  ? 'border-[var(--text-primary)] bg-[var(--bg-surface)] text-[var(--text-primary)]'
                  : 'border-[var(--border-color)] bg-[var(--bg-main)] text-[var(--text-muted)] hover:-translate-x-px hover:-translate-y-px hover:bg-[var(--bg-surface)] hover:text-[var(--text-primary)]'
              }`}
            >
              <span className="block min-w-0 truncate">{option}</span>
            </button>
          ))}
        </div>
      </div>
    ) : null;

  return (
    <div
      ref={rootRef}
      data-design-system-component="true"
      data-design-system-component-name="Combobox"
      className={`relative min-w-0 ${className}`}
    >
      <input
        value={value}
        disabled={disabled}
        placeholder={placeholder}
        aria-label={placeholder}
        role="combobox"
        aria-expanded={open && canOpen}
        aria-autocomplete="list"
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
          if (event.key === 'Escape') setOpen(false);
          if (event.key === 'ArrowDown' && canOpen) {
            event.preventDefault();
            setMenuMode('browse');
            setOpen(true);
          }
        }}
        className={`input-swiss w-full min-w-0 !px-2 !py-1.5 !pr-8 !text-[length:var(--font-size-ui-sm)] disabled:opacity-50 ${
          align === 'right' ? 'text-right' : ''
        }`}
      />
      <button
        type="button"
        disabled={!canOpen}
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => {
          if (canOpen) {
            setMenuMode('browse');
            setOpen((prev) => !prev);
          }
        }}
        className="absolute right-1 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center border-l border-[var(--border-color)] bg-[var(--bg-main)] text-[var(--text-muted)] hover:bg-[var(--bg-surface)] hover:text-[var(--text-primary)] disabled:cursor-not-allowed disabled:opacity-35"
        aria-label="Toggle options"
        tabIndex={-1}
      >
        <ChevronDown className="h-3.5 w-3.5" strokeWidth={4} />
      </button>
      {typeof document !== 'undefined' ? createPortal(dropdown, document.body) : null}
    </div>
  );
}
