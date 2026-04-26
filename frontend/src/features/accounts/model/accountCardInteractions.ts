type ElementLike = {
  tagName?: string | null;
  parentElement?: ElementLike | null;
  dataset?: Record<string, string | undefined>;
};

const INTERACTIVE_TAGS = new Set(['A', 'BUTTON', 'INPUT', 'LABEL', 'SELECT', 'TEXTAREA']);

function isInteractiveElement(element: ElementLike | null | undefined) {
  if (!element) {
    return false;
  }

  if (element.dataset?.accountCardIgnoreClick === 'true') {
    return true;
  }

  const tagName = typeof element.tagName === 'string' ? element.tagName.toUpperCase() : '';
  return INTERACTIVE_TAGS.has(tagName);
}

export function shouldOpenAccountDetailsFromTarget(target: EventTarget | ElementLike | null, currentTarget: EventTarget | ElementLike | null) {
  let cursor = target as ElementLike | null;
  const boundary = currentTarget as ElementLike | null;

  while (cursor && cursor !== boundary) {
    if (isInteractiveElement(cursor)) {
      return false;
    }
    cursor = cursor.parentElement ?? null;
  }

  return true;
}
