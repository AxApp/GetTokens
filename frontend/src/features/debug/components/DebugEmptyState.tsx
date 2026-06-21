import { useI18n } from '../../../context/I18nContext';

export default function DebugEmptyState() {
  const { t } = useI18n();
  return (
    <div
      className="rounded-lg border border-dashed p-20 text-center text-sm font-normal"
      style={{ borderColor: 'var(--gt-border-default)', color: 'var(--gt-ink-muted)', fontFamily: 'var(--gt-font-family-sans)' }}
    >
      {t('debug.empty')}
    </div>
  );
}
