import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Button, Menu, Tooltip } from 'antd';
import type { MenuProps } from 'antd';
import type { AccountDetailLocalCliAction } from './AccountDetailSections';

export interface AccountDetailSectionNavItem {
  id: string;
  title: string;
}

const accountDetailNavLocalActionsClass =
  'border-t border-[var(--gt-border-subtle)] px-3 py-3';
const accountDetailNavLocalActionButtonClass =
  '!h-8 !w-full !rounded-md !border-[var(--gt-border-subtle)] !bg-[var(--gt-surface-muted)] !px-3 !text-xs !font-semibold !text-[var(--gt-ink-primary)] hover:!border-[var(--gt-ink-primary)] hover:!bg-[var(--gt-surface-canvas)] disabled:!cursor-not-allowed disabled:!opacity-45';

/* ── Sidebar Navigation ── */

function SectionNav({
  items,
  activeId,
  onSelect,
  localCliActions = [],
}: {
  items: AccountDetailSectionNavItem[];
  activeId: string;
  onSelect: (id: string) => void;
  localCliActions?: ReadonlyArray<AccountDetailLocalCliAction>;
}) {
  const menuItems = useMemo<MenuProps['items']>(
    () => items.map((item) => ({ key: item.id, label: item.title })),
    [items],
  );

  const handleMenuClick: MenuProps['onClick'] = (info) => {
    onSelect(info.key);
  };

  return (
    <nav
      className="flex w-[200px] shrink-0 flex-col border-r border-[var(--gt-border-subtle)] bg-[var(--gt-surface-canvas)]"
      aria-label="Account detail sections"
    >
      <div className="flex-1 overflow-y-auto py-1">
        <Menu
          mode="inline"
          selectable
          items={menuItems}
          selectedKeys={[activeId]}
          onClick={handleMenuClick}
          data-account-detail-section-nav="antd"
          style={{
            borderInlineEnd: 0,
            background: 'transparent',
            fontFamily: 'var(--gt-font-family-sans)',
            fontSize: 14,
            userSelect: 'text',
          }}
        />
      </div>
      {localCliActions.length > 0 ? (
        <div data-account-detail-nav-local-cli-actions className={accountDetailNavLocalActionsClass} style={{ userSelect: 'text' }}>
          {localCliActions.map((action) => (
            <Tooltip title={action.disabledReason || action.detail || action.label}>
              <Button
                key={action.id}
                data-account-detail-nav-local-cli-action={action.id}
                htmlType="button"
                type="default"
                size="small"
                block
                disabled={action.disabled}
                aria-label={action.label}
                onClick={() => {
                  if (action.disabled) {
                    return;
                  }
                  action.onSelect();
                }}
                className={accountDetailNavLocalActionButtonClass}
              >
                {action.label}
              </Button>
            </Tooltip>
          ))}
        </div>
      ) : null}
    </nav>
  );
}

/* ── Layout: sidebar + scrollable content with scroll-spy ── */

export function AccountDetailLayout({
  sectionNavItems,
  localCliActions,
  header,
  notice,
  children,
}: {
  sectionNavItems: AccountDetailSectionNavItem[];
  localCliActions?: ReadonlyArray<AccountDetailLocalCliAction>;
  header?: ReactNode;
  notice?: ReactNode;
  children: ReactNode;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [activeSection, setActiveSection] = useState(sectionNavItems[0]?.id ?? '');

  // Scroll-spy: observe section elements and update active section
  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;

    const observer = new IntersectionObserver(
      (entries) => {
        // Find the topmost visible section
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);

        if (visible.length > 0) {
          const sectionId = visible[0].target.getAttribute('data-account-detail-section');
          if (sectionId) {
            setActiveSection(sectionId);
          }
        }
      },
      {
        root: container,
        rootMargin: '-20% 0px -60% 0px',
        threshold: 0,
      }
    );

    // Observe all section elements
    const sections = container.querySelectorAll('[data-account-detail-section]');
    sections.forEach((el) => observer.observe(el));

    return () => observer.disconnect();
  }, [children]);

  // Click navigation: scroll to section
  function handleSelect(sectionId: string) {
    setActiveSection(sectionId);
    const container = scrollRef.current;
    if (!container) return;
    const target = container.querySelector(`[data-account-detail-section="${sectionId}"]`);
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  return (
    <div className="flex h-full min-h-0">
      <SectionNav
        items={sectionNavItems}
        activeId={activeSection}
        onSelect={handleSelect}
        localCliActions={localCliActions}
      />
      <div
        ref={scrollRef}
        className="min-w-0 flex-1 overflow-y-auto"
        style={{ userSelect: 'text' }}
      >
        <div
          className="mx-auto max-w-[42rem] space-y-6 px-8 pt-14 pb-6"
          style={{
            fontFamily: 'var(--gt-font-family-sans)',
            fontSize: 'var(--gt-font-size-lg)',
            lineHeight: '1.6',
            color: 'var(--gt-ink-primary)',
            userSelect: 'text',
          }}
        >
          {header}
          {notice}
          {children}
        </div>
      </div>
    </div>
  );
}
