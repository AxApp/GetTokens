import type { MouseEvent } from 'react';
import { BrowserOpenURL } from '../../../wailsjs/runtime/runtime';
import WorkspacePageHeader from '../../components/ui/WorkspacePageHeader';
import { useI18n } from '../../context/I18nContext';
import { hasWailsRuntime } from '../../utils/previewMode';
import {
  businessDesignSystemPreviews,
} from './businessComponentPreviews';
import { getBusinessDesignSystemPreviewStats } from './businessComponentPreviewCatalog';
import {
  DESIGN_SYSTEM_SCREENSHOT_PATH,
  DESIGN_SYSTEM_STORYBOOK_COMMAND,
  DESIGN_SYSTEM_STORYBOOK_URL,
  designSystemStoryGroups,
  getDesignSystemStoryStats,
  resolveDesignSystemInspectOpenURL,
  resolveDesignSystemStorybookOpenURL,
  resolveDesignSystemWebOpenURL,
} from './storyCatalog';

export default function DesignSystemEntryFeature() {
  const { t } = useI18n();
  const stats = getDesignSystemStoryStats();
  const businessStats = getBusinessDesignSystemPreviewStats();
  const storybookOpenURL = resolveDesignSystemStorybookOpenURL({
    origin: typeof window === 'undefined' ? undefined : window.location.origin,
  });
  const webOpenURL = resolveDesignSystemWebOpenURL({
    origin: typeof window === 'undefined' ? undefined : window.location.origin,
  });
  const inspectOpenURL = resolveDesignSystemInspectOpenURL({
    origin: typeof window === 'undefined' ? undefined : window.location.origin,
  });
  const showDevWebOpen = import.meta.env.DEV;

  function openExternalURL(event: MouseEvent<HTMLAnchorElement>, url: string) {
    event.preventDefault();
    if (hasWailsRuntime()) {
      BrowserOpenURL(url);
      return;
    }
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  return (
    <div className="h-full overflow-auto bg-[var(--bg-surface)] p-8 text-[var(--text-primary)]">
      <div className="mx-auto flex max-w-6xl flex-col gap-8">
        <WorkspacePageHeader
          title={t('design_system.title')}
          subtitle={t('design_system.subtitle')}
          actions={
            <div className="flex flex-wrap items-center justify-end gap-2">
              <a
                className="btn-swiss bg-[var(--border-color)] !text-[var(--bg-main)]"
                href={storybookOpenURL}
                onClick={(event) => openExternalURL(event, storybookOpenURL)}
                target="_blank"
                rel="noreferrer"
              >
                {t('design_system.open_storybook')}
              </a>
              {showDevWebOpen ? (
                <>
                  <a
                    className="btn-swiss"
                    href={inspectOpenURL}
                    onClick={(event) => openExternalURL(event, inspectOpenURL)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {t('design_system.inspect_elements')}
                  </a>
                  <a
                    className="btn-swiss"
                    href={webOpenURL}
                    onClick={(event) => openExternalURL(event, webOpenURL)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {t('design_system.open_web')}
                  </a>
                </>
              ) : null}
            </div>
          }
        />

        <section className="grid gap-4 md:grid-cols-[minmax(0,1fr)_18rem]">
          <div className="card-swiss grid gap-5">
            <div>
              <div className="text-[length:var(--font-size-ui-sm)] font-black uppercase tracking-normal text-[var(--text-muted)]">
                {t('design_system.primary_entry')}
              </div>
              <div className="mt-2 text-2xl font-black uppercase italic tracking-normal">
                Storybook
              </div>
            </div>

            <div className="grid gap-3">
              <InfoRow label={t('design_system.command')} value={DESIGN_SYSTEM_STORYBOOK_COMMAND} />
              <InfoRow label={t('design_system.url')} value={DESIGN_SYSTEM_STORYBOOK_URL} />
              <InfoRow label={t('design_system.screenshot_path')} value={DESIGN_SYSTEM_SCREENSHOT_PATH} />
            </div>
          </div>

          <aside className="card-swiss grid content-start gap-4">
            <div className="text-[length:var(--font-size-ui-sm)] font-black uppercase tracking-normal text-[var(--text-muted)]">
              {t('design_system.coverage')}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Metric label={t('design_system.groups')} value={stats.groupCount} />
              <Metric label={t('design_system.stories')} value={stats.storyCount} />
              <Metric label="业务预览" value={businessStats.previewCount} />
              <Metric label="业务状态" value={businessStats.stateCount} />
            </div>
          </aside>
        </section>

        <section className="grid gap-4">
          <div className="card-swiss !p-0">
            <div className="border-b-2 border-[var(--border-color)] px-5 py-4">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h3 className="text-xl font-black uppercase italic tracking-normal">业务组件预览</h3>
                  <p className="mt-1 text-[length:var(--font-size-ui-sm)] font-bold uppercase tracking-normal text-[var(--text-muted)]">
                    业务组件在 5173 应用内设计系统直接渲染，不进入 6006 Storybook。
                  </p>
                </div>
                <span className="border-2 border-[var(--border-color)] px-2 py-1 font-mono text-[length:var(--font-size-ui-xs)] font-black">
                  {businessDesignSystemPreviews.length} {t('design_system.items')}
                </span>
              </div>
            </div>
            <div className="grid gap-6 bg-[var(--bg-surface)] p-5">
              {businessDesignSystemPreviews.map((preview) => (
                <section key={preview.id} className="grid gap-4">
                  <div className="grid gap-2 border-2 border-[var(--border-color)] bg-[var(--bg-main)] p-4">
                    <div className="text-lg font-black uppercase italic tracking-normal">{preview.title}</div>
                    <p className="text-[length:var(--font-size-ui-sm)] font-bold text-[var(--text-muted)]">
                      {preview.description}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {preview.states.map((state) => (
                        <span
                          key={`${preview.id}-${state}`}
                          className="border border-[var(--border-color)] px-2 py-1 text-[length:var(--font-size-ui-2xs)] font-black uppercase tracking-[0.14em]"
                        >
                          {state}
                        </span>
                      ))}
                    </div>
                    <code className="break-all font-mono text-[length:var(--font-size-ui-xs)] font-bold text-[var(--text-muted)]">
                      {preview.sourcePath}
                    </code>
                  </div>
                  <div className="min-w-0">{preview.render()}</div>
                </section>
              ))}
            </div>
          </div>
        </section>

        <section className="grid gap-4">
          {designSystemStoryGroups.map((group) => (
            <div key={group.id} className="card-swiss !p-0">
              <div className="border-b-2 border-[var(--border-color)] px-5 py-4">
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <div>
                    <h3 className="text-xl font-black uppercase italic tracking-normal">{group.title}</h3>
                    <p className="mt-1 text-[length:var(--font-size-ui-sm)] font-bold uppercase tracking-normal text-[var(--text-muted)]">
                      {group.description}
                    </p>
                  </div>
                  <span className="border-2 border-[var(--border-color)] px-2 py-1 font-mono text-[length:var(--font-size-ui-xs)] font-black">
                    {group.stories.length} {t('design_system.items')}
                  </span>
                </div>
              </div>
              <div className="divide-y-2 divide-[var(--border-color)]">
                {group.stories.map((story) => (
                  <div key={story.id} className="grid gap-2 px-5 py-4 md:grid-cols-[13rem_minmax(0,1fr)] md:items-center">
                    <div className="font-black uppercase italic tracking-normal">{story.title}</div>
                    <div className="min-w-0">
                      <div className="truncate font-mono text-[length:var(--font-size-ui-sm)] font-bold text-[var(--text-muted)]">
                        {story.storybookTitle}
                      </div>
                      <div className="mt-1 truncate font-mono text-[length:var(--font-size-ui-xs)] text-[var(--text-muted)]/70">
                        {story.path}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </section>
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-2 border-2 border-[var(--border-color)] bg-[var(--bg-surface)] p-3">
      <div className="text-[length:var(--font-size-ui-xs)] font-black uppercase tracking-normal text-[var(--text-muted)]">
        {label}
      </div>
      <code className="break-all font-mono text-[length:var(--font-size-ui-md-compact)] font-bold">{value}</code>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="border-2 border-[var(--border-color)] bg-[var(--bg-surface)] p-3">
      <div className="font-mono text-2xl font-black">{value}</div>
      <div className="mt-1 text-[length:var(--font-size-ui-xs)] font-black uppercase tracking-normal text-[var(--text-muted)]">
        {label}
      </div>
    </div>
  );
}
