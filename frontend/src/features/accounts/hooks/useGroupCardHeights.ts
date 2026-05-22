import { useLayoutEffect, useState, type MutableRefObject } from 'react';
import {
  resolveAccountCardColumnHeights,
  shouldEqualizeAccountCardDisplayMode,
  shouldEqualizeAccountCardGrid,
} from '../model/accountCardLayout';
import type { AccountListDisplayMode } from '../model/accountListLayout';
import type { AccountGroup } from '../model/types';

export default function useGroupCardHeights(
  pageRef: MutableRefObject<HTMLDivElement | null>,
  groupedAccounts: AccountGroup[],
  loading: boolean,
  selectedAccountIDs: string[],
  displayMode: AccountListDisplayMode,
) {
  const [accountCardHeights, setAccountCardHeights] = useState<Record<string, number>>({});

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

    if (!shouldEqualizeAccountCardDisplayMode(displayMode)) {
      clearInlineHeights();
      setAccountCardHeights({});
      return;
    }

    const measure = () => {
      const nextHeights: Record<string, number> = {};
      const measuredCards: HTMLElement[] = [];
      const groupNodes = pageNode.querySelectorAll<HTMLElement>('[data-plan-group-grid]');
      groupNodes?.forEach((groupNode) => {
        const cards = Array.from(groupNode.querySelectorAll<HTMLElement>('[data-account-card]'));
        if (cards.length === 0) {
          return;
        }
        cards.forEach((card) => {
          card.style.minHeight = '0px';
        });
        if (!shouldEqualizeAccountCardGrid(window.getComputedStyle(groupNode).gridTemplateColumns, cards.length)) {
          return;
        }
        measuredCards.push(...cards);
        Object.assign(
          nextHeights,
          resolveAccountCardColumnHeights(
            cards
              .map((card) => ({
                id: card.dataset.accountCardId || '',
                columnLeft: card.offsetLeft,
                height: card.offsetHeight,
              }))
              .filter((card) => card.id),
          ),
        );
      });

      measuredCards.forEach((card) => {
        const cardID = card.dataset.accountCardId || '';
        const minHeight = cardID && nextHeights[cardID] ? `${nextHeights[cardID]}px` : '0px';
        card.style.minHeight = minHeight;
      });

      setAccountCardHeights((prev) => {
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

  return accountCardHeights;
}
