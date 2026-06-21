import { Button } from 'antd';
import { useI18n } from '../../../context/I18nContext';

interface DebugHeaderProps {
  count: number;
  allSelected: boolean;
  selectedCount: number;
  copyState: 'idle' | 'success' | 'error';
  onToggleSelectAll: () => void;
  onClearSelection: () => void;
  onCopySelected: () => void;
  onClearAll: () => void;
}

export default function DebugHeader({
  count,
  allSelected,
  selectedCount,
  copyState,
  onToggleSelectAll,
  onClearSelection,
  onCopySelected,
  onClearAll,
}: DebugHeaderProps) {
  const { t } = useI18n();

  return (
    <header
      className="flex items-end justify-between border-b pb-4"
      style={{ borderColor: 'var(--gt-border-subtle)' }}
    >
      <div>
        <h2
          className="text-2xl font-bold"
          style={{ color: 'var(--gt-ink-primary)', fontFamily: 'var(--gt-font-family-sans)' }}
        >
          {t('debug.title')}
        </h2>
        <p
          className="mt-1 text-sm"
          style={{ color: 'var(--gt-ink-muted)', fontFamily: 'var(--gt-font-family-sans)' }}
        >
          {t('debug.subtitle')} · {count}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <Button size="small" onClick={onToggleSelectAll} disabled={count === 0}>
          {allSelected ? t('debug.unselect_all') : t('debug.select_all')}
        </Button>
        <Button size="small" onClick={onClearSelection} disabled={selectedCount === 0}>
          {t('debug.clear_selection')}
        </Button>
        <Button size="small" type="primary" onClick={onCopySelected} disabled={selectedCount === 0}>
          {copyState === 'success'
            ? t('debug.copy_success')
            : copyState === 'error'
              ? t('debug.copy_error')
              : `${t('debug.copy_selected')} (${selectedCount})`}
        </Button>
        <Button size="small" onClick={onClearAll} disabled={count === 0}>
          {t('debug.clear')}
        </Button>
      </div>
    </header>
  );
}
