import { useLayoutEffect, useState, type MutableRefObject } from 'react';
import { shouldEqualizeAccountCardGrid } from '../model/accountCardLayout';
import type { AccountListDisplayMode } from '../model/accountListLayout';
import type { AccountGroup } from '../model/types';

export default function useGroupCardHeights(
  pageRef: MutableRefObject<HTMLDivElement | null>,
  groupedAccounts: AccountGroup[],
  loading: boolean,
  selectedAccountIDs: string[],
  displayMode: AccountListDisplayMode,
) {
  const [groupCardHeights, setGroupCardHeights] = useState<Record<string, number>>({});

  useLayoutEffect(() => {
    const pageNode = pageRef.current;
    if (!pageNode) {
      return;
    }

    const clearInlineHeights = () => {
      pageNode.querySelectorAll<HTMLElement>('[data-account-card]').forEach((card) => {
        card.style.minHeight = '0px';
      });
    };

    if (displayMode !== 'full') {
      clearInlineHeights();
      setGroupCardHeights({});
      return;
    }

    const measure = () => {
      const nextHeights: Record<string, number> = {};
      const cardsByGroup: Record<string, HTMLElement[]> = {};
      const groupNodes = pageNode.querySelectorAll<HTMLElement>('[data-plan-group-grid]');
      groupNodes?.forEach((groupNode) => {
        const groupID = groupNode.dataset.planGroupGrid;
        if (!groupID) {
          return;
        }
        const cards = Array.from(groupNode.querySelectorAll<HTMLElement>('[data-account-card]'));
        if (cards.length === 0) {
          return;
        }
        cardsByGroup[groupID] = cards;
        cards.forEach((card) => {
          card.style.minHeight = '0px';
        });
        if (!shouldEqualizeAccountCardGrid(window.getComputedStyle(groupNode).gridTemplateColumns, cards.length)) {
          return;
        }
        const maxHeight = cards.reduce((current, card) => Math.max(current, card.offsetHeight), 0);
        if (maxHeight > 0) {
          nextHeights[groupID] = maxHeight;
        }
      });

      Object.entries(cardsByGroup).forEach(([groupID, cards]) => {
        const minHeight = nextHeights[groupID] ? `${nextHeights[groupID]}px` : '0px';
        cards.forEach((card) => {
          card.style.minHeight = minHeight;
        });
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

    let frameID = window.requestAnimationFrame(measure);
    const scheduleMeasure = () => {
      window.cancelAnimationFrame(frameID);
      frameID = window.requestAnimationFrame(measure);
    };

    const resizeObserver = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(scheduleMeasure);
    resizeObserver?.observe(pageNode);
    pageNode.querySelectorAll<HTMLElement>('[data-plan-group-grid]').forEach((groupNode) => {
      resizeObserver?.observe(groupNode);
    });
    window.addEventListener('resize', scheduleMeasure);
    return () => {
      window.cancelAnimationFrame(frameID);
      resizeObserver?.disconnect();
      window.removeEventListener('resize', scheduleMeasure);
    };
  }, [displayMode, groupedAccounts, loading, pageRef, selectedAccountIDs]);

  return groupCardHeights;
}
