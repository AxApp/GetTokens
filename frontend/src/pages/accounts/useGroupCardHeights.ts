import { useLayoutEffect, useState, type MutableRefObject } from 'react';
import type { AccountGroup } from './types';

export default function useGroupCardHeights(
  pageRef: MutableRefObject<HTMLDivElement | null>,
  groupedAccounts: AccountGroup[],
  loading: boolean,
  selectedAccountIDs: string[]
) {
  const [groupCardHeights, setGroupCardHeights] = useState<Record<string, number>>({});

  useLayoutEffect(() => {
    if (!pageRef.current) {
      return;
    }

    const measure = () => {
      const nextHeights: Record<string, number> = {};
      const groupNodes = pageRef.current?.querySelectorAll<HTMLElement>('[data-plan-group-grid]');
      groupNodes?.forEach((groupNode) => {
        const groupID = groupNode.dataset.planGroupGrid;
        if (!groupID) {
          return;
        }
        const cards = Array.from(groupNode.querySelectorAll<HTMLElement>('[data-account-card]'));
        if (cards.length === 0) {
          return;
        }
        cards.forEach((card) => {
          card.style.minHeight = '0px';
        });
        const maxHeight = cards.reduce((current, card) => Math.max(current, card.offsetHeight), 0);
        if (maxHeight > 0) {
          nextHeights[groupID] = maxHeight;
        }
      });

      setGroupCardHeights((prev) => {
        const prevKeys = Object.keys(prev);
        const nextKeys = Object.keys(nextHeights);
        if (prevKeys.length === nextKeys.length && prevKeys.every((key) => prev[key] === nextHeights[key])) {
          return prev;
        }
        return nextHeights;
      });
    };

    const frameID = window.requestAnimationFrame(measure);
    window.addEventListener('resize', measure);
    return () => {
      window.cancelAnimationFrame(frameID);
      window.removeEventListener('resize', measure);
    };
  }, [groupedAccounts, loading, pageRef, selectedAccountIDs]);

  return groupCardHeights;
}
