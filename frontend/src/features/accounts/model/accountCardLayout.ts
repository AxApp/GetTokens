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
