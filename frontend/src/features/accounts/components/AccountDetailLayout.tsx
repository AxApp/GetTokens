import { useEffect, useRef, useState, type ReactNode } from 'react';

export interface AccountDetailSectionNavItem {
  id: string;
  title: string;
}

/* ── Sidebar Navigation ── */

function SectionNav({
  items,
  activeId,
  onSelect,
  header,
}: {
  items: AccountDetailSectionNavItem[];
  activeId: string;
  onSelect: (id: string) => void;
  header?: ReactNode;
}) {
  return (
    <nav
      className="flex w-[200px] shrink-0 flex-col border-r border-[var(--gt-border-subtle)] bg-[var(--gt-surface-canvas)]"
      aria-label="Account detail sections"
    >
      {header && (
        <div className="border-b border-[var(--gt-border-subtle)] px-4 py-3" style={{ userSelect: 'text' }}>
          {header}
        </div>
      )}
      <div className="flex-1 overflow-y-auto py-2">
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => onSelect(item.id)}
            className={`w-full px-4 py-2 text-left text-sm transition duration-75 ${
              activeId === item.id
                ? 'bg-[var(--gt-surface-muted)] font-medium text-[var(--gt-ink-primary)]'
                : 'text-[var(--gt-ink-secondary)] hover:bg-[var(--gt-surface-muted)]'
            }`}
            style={{ fontFamily: 'var(--gt-font-family-sans)' }}
          >
            {item.title}
          </button>
        ))}
      </div>
    </nav>
  );
}

/* ── Layout: sidebar + scrollable content with scroll-spy ── */

export function AccountDetailLayout({
  sectionNavItems,
  header,
  children,
}: {
  sectionNavItems: AccountDetailSectionNavItem[];
  header?: ReactNode;
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
        header={header}
      />
      <div
        ref={scrollRef}
        className="min-w-0 flex-1 overflow-y-auto"
        style={{ userSelect: 'text' }}
      >
        <div
          className="mx-auto max-w-[42rem] space-y-6 px-8 py-6"
          style={{
            fontFamily: 'var(--gt-font-family-sans)',
      fontSize: 'var(--gt-font-size-lg)',
            lineHeight: '1.6',
            color: 'var(--gt-ink-primary)',
            userSelect: 'text',
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
