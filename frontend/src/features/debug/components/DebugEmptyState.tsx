import { useI18n } from '../../../context/I18nContext';

export default function DebugEmptyState() {
  const { t } = useI18n();
  return (
    <div className="border-2 border-dashed border-[var(--border-color)] p-20 text-center font-black uppercase italic text-[var(--text-muted)]">
      {t('debug.empty')}
    </div>
  );
}
