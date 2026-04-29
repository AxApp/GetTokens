import { useI18n } from '../../context/I18nContext';
import type { SessionManagementWorkspace } from '../../types';

interface SessionManagementFeatureProps {
  workspace: SessionManagementWorkspace;
}

const workspaceContent: Record<
  SessionManagementWorkspace,
  {
    heroMeta: string;
    heroTitleKey: string;
    heroDescriptionKey: string;
    statusTitleKey: string;
    panelTagKey: string;
    panelTagTone?: 'accent' | 'success';
  }
> = {
  'codex-sessions': {
    heroMeta: 'session management / codex',
    heroTitleKey: 'session_management.workspaces.codex_sessions.title',
    heroDescriptionKey: 'session_management.workspaces.codex_sessions.description',
    statusTitleKey: 'session_management.status.codex_sessions',
    panelTagKey: 'session_management.list_tags.group_rewrite_enabled',
    panelTagTone: 'success',
  },
  'provider-groups': {
    heroMeta: 'session management / provider',
    heroTitleKey: 'session_management.workspaces.provider_groups.title',
    heroDescriptionKey: 'session_management.workspaces.provider_groups.description',
    statusTitleKey: 'session_management.status.provider_groups',
    panelTagKey: 'session_management.list_tags.mixed_provider_watch',
    panelTagTone: 'accent',
  },
};

interface SessionListAction {
  key: string;
  tone?: 'accent' | 'success';
}

interface SessionListItem {
  active?: boolean;
  tags: readonly string[];
  title: string;
  note: string;
  actions: readonly SessionListAction[];
}

const listItems: readonly SessionListItem[] = [
  {
    active: true,
    tags: ['session_management.list_tags.thread_61ab', 'session_management.list_tags.usage_142', 'session_management.list_tags.live'],
    title: 'session_management.list_items.usage_desk_boundary.title',
    note: 'session_management.list_items.usage_desk_boundary.note',
    actions: [{ key: 'session_management.list_tags.selected', tone: 'accent' as const }, { key: 'session_management.list_tags.resume' }],
  },
  {
    tags: ['session_management.list_tags.thread_5c20', 'session_management.list_tags.archived', 'session_management.list_tags.usage_86'],
    title: 'session_management.list_items.cache_boundary.title',
    note: 'session_management.list_items.cache_boundary.note',
    actions: [{ key: 'session_management.list_tags.copy_cmd' }],
  },
  {
    tags: ['session_management.list_tags.thread_91de', 'session_management.list_tags.timeline_ready', 'session_management.list_tags.usage_54'],
    title: 'session_management.list_items.logical_usage.title',
    note: 'session_management.list_items.logical_usage.note',
    actions: [{ key: 'session_management.list_tags.finder' }],
  },
  {
    tags: ['session_management.list_tags.thread_8f2a', 'session_management.list_tags.mixed_provider'],
    title: 'session_management.list_items.grouping_divergence.title',
    note: 'session_management.list_items.grouping_divergence.note',
    actions: [{ key: 'session_management.list_tags.row_rewrite', tone: 'accent' as const }],
  },
] as const;

const detailSlots = [
  {
    meta: 'session_management.detail.identity.meta',
    title: 'session_management.detail.identity.title',
    note: 'session_management.detail.identity.note',
  },
  {
    meta: 'session_management.detail.snapshot_source.meta',
    title: 'session_management.detail.snapshot_source.title',
    note: 'session_management.detail.snapshot_source.note',
  },
  {
    meta: 'session_management.detail.summary.meta',
    title: 'session_management.detail.summary.title',
    note: 'session_management.detail.summary.note',
  },
  {
    meta: 'session_management.detail.actions.meta',
    title: 'session_management.detail.actions.title',
    note: 'session_management.detail.actions.note',
  },
] as const;

const timelineSteps = [
  {
    index: '01',
    title: 'session_management.timeline.preview.title',
    note: 'session_management.timeline.preview.note',
  },
  {
    index: '02',
    title: 'session_management.timeline.live_rollout.title',
    note: 'session_management.timeline.live_rollout.note',
  },
  {
    index: '03',
    title: 'session_management.timeline.archived_rollout.title',
    note: 'session_management.timeline.archived_rollout.note',
  },
  {
    index: '04',
    title: 'session_management.timeline.state_db.title',
    note: 'session_management.timeline.state_db.note',
  },
  {
    index: '05',
    title: 'session_management.timeline.verify.title',
    note: 'session_management.timeline.verify.note',
  },
] as const;

const footerBlocks = [
  {
    title: 'session_management.footer.why.title',
    note: 'session_management.footer.why.note',
  },
  {
    title: 'session_management.footer.strength.title',
    note: 'session_management.footer.strength.note',
  },
  {
    title: 'session_management.footer.next.title',
    note: 'session_management.footer.next.note',
  },
] as const;

export default function SessionManagementFeature({ workspace }: SessionManagementFeatureProps) {
  const { t } = useI18n();
  const content = workspaceContent[workspace];

  return (
    <section className="flex h-full flex-col overflow-auto bg-[var(--bg-surface)] text-[var(--text-primary)]">
      <div className="border-b-2 border-[var(--border-color)] bg-[var(--bg-main)] px-7 py-7">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div className="min-w-0 flex-1">
            <div className="text-[10px] font-black uppercase tracking-[0.16em] text-[var(--text-muted)]">{content.heroMeta}</div>
            <h1 className="mt-2 text-[56px] font-black italic uppercase leading-[0.9] tracking-[-0.09em]">
              {t(content.heroTitleKey)}
            </h1>
            <p className="mt-4 max-w-4xl text-[14px] leading-7 text-[var(--text-muted)]">{t(content.heroDescriptionKey)}</p>
          </div>
          <div className="flex flex-wrap items-start justify-end gap-3">
            <HeaderTab active>{t('session_management.actions.all_sessions')}</HeaderTab>
            <HeaderTab>{t('session_management.actions.archived_only')}</HeaderTab>
            <HeaderAction>{t('session_management.actions.copy_thread_ids')}</HeaderAction>
            <HeaderAction primary>{t('session_management.actions.preview_rewrite')}</HeaderAction>
          </div>
        </div>
      </div>

      <div className="flex-1 p-7">
        <section className="border-2 border-[var(--border-color)] bg-[var(--bg-main)] px-5 py-4">
          <div className="flex flex-wrap items-center justify-between gap-5">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-3">
                <span className="h-3.5 w-3.5 shrink-0 bg-[var(--accent-red)]" />
                <span className="truncate text-[11px] font-black uppercase tracking-[0.16em]">{t(content.statusTitleKey)}</span>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <SummaryChip>{t('session_management.summary.visible_48')}</SummaryChip>
                <SummaryChip>{t('session_management.summary.eligible_groups_12')}</SummaryChip>
                <SummaryChip>{t('session_management.summary.provider_drift_7')}</SummaryChip>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <CompactTab active>{t('session_management.sort.project')}</CompactTab>
              <CompactTab>{t('session_management.sort.provider')}</CompactTab>
              <CompactTab active>{t('session_management.sort.usage')}</CompactTab>
              <CompactTab>{t('session_management.sort.recent')}</CompactTab>
            </div>
          </div>
        </section>

        <section className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1.18fr)_minmax(360px,0.92fr)]">
          <section className="overflow-hidden border-2 border-[var(--border-color)] bg-[var(--bg-main)] shadow-[8px_8px_0_var(--shadow-color)]">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b-2 border-[var(--border-color)] px-5 py-4">
              <div>
                <h2 className="text-[18px] font-black uppercase tracking-[0.04em]">{t('session_management.panels.session_list')}</h2>
              </div>
              <div className="flex flex-wrap gap-2">
                <Tag>{t('session_management.list_tags.project_gettokens')}</Tag>
                <Tag tone={content.panelTagTone}>{t(content.panelTagKey)}</Tag>
              </div>
            </div>

            <div className="space-y-3 p-4">
              {listItems.map((item) => (
                <article
                  key={item.title}
                  className={`flex flex-wrap items-start justify-between gap-4 border-2 px-4 py-4 ${
                    item.active
                      ? 'border-[var(--border-color)] bg-[var(--bg-surface)] shadow-[4px_4px_0_var(--shadow-color)]'
                      : 'border-[var(--shadow-color)] bg-[var(--bg-main)]'
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap gap-2">
                      {item.tags.map((tag) => (
                        <Tag key={tag}>{t(tag)}</Tag>
                      ))}
                    </div>
                    <div className="mt-3 text-[18px] font-black leading-6 tracking-[-0.03em]">{t(item.title)}</div>
                    <p className="mt-2 text-[12px] font-bold leading-5 text-[var(--text-muted)]">{t(item.note)}</p>
                  </div>
                  <div className="flex flex-wrap items-start justify-end gap-2">
                    {item.actions.map((action) => (
                      <Tag key={action.key} tone={action.tone}>
                        {t(action.key)}
                      </Tag>
                    ))}
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section className="overflow-hidden border-2 border-[var(--border-color)] bg-[var(--bg-main)] shadow-[8px_8px_0_var(--shadow-color)]">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b-2 border-[var(--border-color)] px-5 py-4">
              <h2 className="text-[18px] font-black uppercase tracking-[0.04em]">{t('session_management.panels.selected_detail')}</h2>
              <div className="flex flex-wrap gap-2">
                <Tag>{t('session_management.detail_tags.store_snapshot')}</Tag>
                <Tag>{t('session_management.detail_tags.timeline_ready')}</Tag>
              </div>
            </div>

            <div className="space-y-4 p-4">
              <div className="border-2 border-[var(--shadow-color)] bg-[var(--bg-surface)] px-4 py-4">
                <div className="text-[10px] font-black uppercase tracking-[0.18em] text-[var(--text-muted)]">
                  {t('session_management.detail.selected_session')}
                </div>
                <div className="mt-2 text-[18px] font-black leading-6 tracking-[-0.03em]">
                  {t('session_management.list_items.usage_desk_boundary.title')}
                </div>
                <p className="mt-2 text-[12px] font-bold leading-5 text-[var(--text-muted)]">
                  {t('session_management.detail.selected_note')}
                </p>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                {detailSlots.map((slot) => (
                  <div key={slot.meta} className="border-2 border-[var(--shadow-color)] bg-[var(--bg-main)] px-4 py-4">
                    <div className="text-[10px] font-black uppercase tracking-[0.18em] text-[var(--text-muted)]">{t(slot.meta)}</div>
                    <div className="mt-2 text-[14px] font-black uppercase leading-5 tracking-[0.02em]">{t(slot.title)}</div>
                    <p className="mt-2 text-[12px] font-bold leading-5 text-[var(--text-muted)]">{t(slot.note)}</p>
                  </div>
                ))}
              </div>

              <div className="border-2 border-[var(--shadow-color)] bg-[var(--bg-surface)] px-4 py-4">
                <div className="text-[10px] font-black uppercase tracking-[0.18em] text-[var(--text-muted)]">
                  {t('session_management.timeline.kicker')}
                </div>
                <div className="mt-4 grid gap-3 md:grid-cols-5">
                  {timelineSteps.map((step) => (
                    <div key={step.index} className="border-2 border-[var(--border-color)] bg-[var(--bg-main)] px-3 py-3">
                      <div className="text-[10px] font-black uppercase tracking-[0.18em] text-[var(--text-muted)]">{step.index}</div>
                      <div className="mt-2 text-[14px] font-black uppercase leading-5 tracking-[0.03em]">{t(step.title)}</div>
                      <p className="mt-2 text-[12px] font-bold leading-5 text-[var(--text-muted)]">{t(step.note)}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>
        </section>

        <section className="mt-5 grid gap-4 xl:grid-cols-3">
          {footerBlocks.map((block) => (
            <div key={block.title} className="border-2 border-[var(--border-color)] bg-[var(--bg-main)] px-4 py-4">
              <div className="text-[14px] font-black uppercase tracking-[0.04em]">{t(block.title)}</div>
              <p className="mt-2 text-[12px] font-bold leading-5 text-[var(--text-muted)]">{t(block.note)}</p>
            </div>
          ))}
        </section>
      </div>
    </section>
  );
}

function HeaderTab({ active = false, children }: { active?: boolean; children: string }) {
  return (
    <div
      className={`border-2 px-4 py-3 text-[11px] font-black uppercase tracking-[0.16em] ${
        active
          ? 'border-[var(--border-color)] bg-[var(--border-color)] text-[var(--bg-main)]'
          : 'border-[var(--border-color)] bg-[var(--bg-main)] text-[var(--text-primary)]'
      }`}
    >
      {children}
    </div>
  );
}

function HeaderAction({ primary = false, children }: { primary?: boolean; children: string }) {
  return (
    <div
      className={`border-2 px-4 py-3 text-[11px] font-black uppercase tracking-[0.16em] shadow-[4px_4px_0_var(--shadow-color)] ${
        primary
          ? 'border-[var(--border-color)] bg-[var(--border-color)] text-[var(--bg-main)]'
          : 'border-[var(--border-color)] bg-[var(--bg-main)] text-[var(--text-primary)]'
      }`}
    >
      {children}
    </div>
  );
}

function CompactTab({ active = false, children }: { active?: boolean; children: string }) {
  return (
    <div
      className={`px-3 py-2 text-[10px] font-black uppercase tracking-[0.18em] ${
        active
          ? 'border-2 border-[var(--border-color)] bg-[var(--border-color)] text-[var(--bg-main)]'
          : 'border-2 border-[var(--border-color)] bg-[var(--bg-main)] text-[var(--text-primary)]'
      }`}
    >
      {children}
    </div>
  );
}

function SummaryChip({ children }: { children: string }) {
  return <div className="border border-[var(--border-color)] bg-[var(--bg-surface)] px-2.5 py-1.5 text-[10px] font-black uppercase tracking-[0.16em]">{children}</div>;
}

function Tag({
  children,
  tone,
}: {
  children: string;
  tone?: 'accent' | 'success';
}) {
  const toneClass =
    tone === 'accent'
      ? 'border-[var(--accent-red)] text-[var(--accent-red)]'
      : tone === 'success'
        ? 'border-[#0f8a4b] text-[#0f8a4b]'
        : 'border-[var(--border-color)] text-[var(--text-muted)]';

  return <span className={`border px-2 py-1 text-[9px] font-black uppercase tracking-[0.16em] ${toneClass}`}>{children}</span>;
}
