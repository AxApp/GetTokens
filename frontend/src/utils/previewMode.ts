export function getPreviewMode() {
  if (typeof window === 'undefined') {
    return '';
  }

  const href = window.location?.href;
  if (typeof href !== 'string' || href.length === 0) {
    return '';
  }

  const url = new URL(href);
  return url.searchParams.get('preview') ?? '';
}

export function hasPreviewMode(expected?: string) {
  const mode = getPreviewMode();
  if (!expected) {
    return mode.length > 0;
  }
  return mode === expected;
}

export function hasWailsRuntime() {
  if (typeof window === 'undefined') {
    return false;
  }

  return typeof (window as Window & { runtime?: { EventsOnMultiple?: unknown } }).runtime?.EventsOnMultiple === 'function';
}

export function hasWailsAppBindings() {
  if (typeof window === 'undefined') {
    return false;
  }

  const runtimeReady =
    typeof (window as Window & { runtime?: { EventsOnMultiple?: unknown } }).runtime?.EventsOnMultiple === 'function';
  const appReady =
    typeof (window as Window & { go?: { main?: { App?: unknown } } }).go?.main?.App === 'object';

  return runtimeReady && appReady;
}
