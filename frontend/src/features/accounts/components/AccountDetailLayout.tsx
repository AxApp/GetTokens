import React, { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Menu } from 'antd';
import type { MenuProps } from 'antd';

export interface AccountDetailSectionNavItem {
  id: string;
  title: string;
}

const accountDetailSectionNavMenuClass =
  'account-detail-section-nav-menu select-text !bg-transparent !font-sans ![border-inline-end:0]';

/* ── Sidebar Navigation ── */

function SectionNav({
  items,
  activeId,
  onSelect,
}: {
  items: AccountDetailSectionNavItem[];
  activeId: string;
  onSelect: (id: string) => void;
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
          className={accountDetailSectionNavMenuClass}
        />
      </div>
    </nav>
  );
}

/* ── Layout: sidebar + scrollable content with scroll-spy ── */

export function AccountDetailLayout({
  sectionNavItems,
  activeSectionID,
  onActiveSectionChange,
  header,
  notice,
  children,
}: {
  sectionNavItems: AccountDetailSectionNavItem[];
  activeSectionID?: string;
  onActiveSectionChange?: (id: string) => void;
  header?: ReactNode;
  notice?: ReactNode;
  children: ReactNode;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [uncontrolledActiveSection, setUncontrolledActiveSection] = useState(() => {
    const requested = new URLSearchParams(window.location.search).get('accountDetailSection') || '';
    return sectionNavItems.some((item) => item.id === requested) ? requested : (sectionNavItems[0]?.id ?? '');
  });
  const activeSection = activeSectionID ?? uncontrolledActiveSection;

  function updateActiveSection(sectionId: string) {
    setUncontrolledActiveSection(sectionId);
    onActiveSectionChange?.(sectionId);
  }

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
            updateActiveSection(sectionId);
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
  }, [children, onActiveSectionChange]);

  // Click navigation: scroll to section
  function handleSelect(sectionId: string) {
    updateActiveSection(sectionId);
    const container = scrollRef.current;
    if (!container) return;
    const target = container.querySelector(`[data-account-detail-section="${sectionId}"]`);
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  const childrenArray = React.Children.toArray(children);
  const activeChild = childrenArray.find((child) => {
    if (React.isValidElement(child)) {
      const childProps = child.props as Record<string, any>;
      return childProps['data-account-detail-section'] === activeSection;
    }
    return false;
  });

  return (
    <div className="flex h-full w-full min-w-0 min-h-0">
      <SectionNav
        items={sectionNavItems}
        activeId={activeSection}
        onSelect={handleSelect}
      />
      <div
        ref={scrollRef}
        className="min-w-0 flex-1 select-text overflow-y-auto"
      >
        <div
          className="mx-auto max-w-[44rem] select-text space-y-6 px-6 sm:px-8 md:px-10 pt-8 pb-8 font-sans text-[length:var(--gt-font-size-lg)] leading-[1.6] text-[var(--gt-ink-primary)]"
        >
          {header}
          {notice}
          {activeChild || children}
        </div>
      </div>
    </div>
  );
}
