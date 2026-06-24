import { useI18n } from '../../../context/I18nContext';

export default function DebugEmptyState() {
  const { t } = useI18n();
  return (
    <div className="rounded-lg border border-dashed border-[var(--gt-border-default)] p-20 text-center text-[length:var(--gt-font-size-sm)] font-normal text-[var(--gt-ink-muted)]">
      {t('debug.empty')}
    </div>
  );
}
