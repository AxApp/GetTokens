import type { AccountListDisplayMode } from './accountListLayout';

export function countRenderedGridColumns(gridTemplateColumns: string | null | undefined): number {
  if (!gridTemplateColumns) {
    return 0;
  }

  const normalized = gridTemplateColumns.trim();
  if (!normalized || normalized === 'none') {
    return 0;
  }

  let depth = 0;
  let count = 0;
  let hasToken = false;

  for (const char of normalized) {
    if (char === '(') {
      depth += 1;
      hasToken = true;
      continue;
    }
    if (char === ')') {
      depth = Math.max(0, depth - 1);
      hasToken = true;
      continue;
    }
    if (/\s/.test(char) && depth === 0) {
      if (hasToken) {
        count += 1;
        hasToken = false;
      }
      continue;
    }
    hasToken = true;
  }

  return hasToken ? count + 1 : count;
}

export function shouldEqualizeAccountCardGrid(
  gridTemplateColumns: string | null | undefined,
  cardCount: number,
): boolean {
  return cardCount > 1 && countRenderedGridColumns(gridTemplateColumns) > 1;
}

export function shouldEqualizeAccountCardDisplayMode(displayMode: AccountListDisplayMode): boolean {
  return displayMode !== 'list';
}

export interface AccountCardColumnMeasurement {
  id: string;
  columnLeft: number;
  height: number;
}

export function resolveAccountCardColumnHeights(
  cards: AccountCardColumnMeasurement[],
): Record<string, number> {
  const maxHeightByColumn: Record<string, number> = {};

  cards.forEach((card) => {
    const columnKey = String(Math.round(card.columnLeft));
    maxHeightByColumn[columnKey] = Math.max(maxHeightByColumn[columnKey] ?? 0, card.height);
  });

  return cards.reduce<Record<string, number>>((result, card) => {
    const columnKey = String(Math.round(card.columnLeft));
    const maxHeight = maxHeightByColumn[columnKey] ?? 0;
    if (maxHeight > 0) {
      result[card.id] = maxHeight;
    }
    return result;
  }, {});
}
