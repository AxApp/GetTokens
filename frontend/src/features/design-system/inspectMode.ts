import { initInspector } from '@linhey/react-debug-inspector';
import {
  DESIGN_SYSTEM_INSPECT_QUERY_PARAM,
  DESIGN_SYSTEM_INSPECT_QUERY_VALUE,
} from './storyCatalog';

type DesignSystemInspectorBridge = {
  start: () => boolean;
};

declare global {
  interface Window {
    __gettokensDesignSystemInspector?: DesignSystemInspectorBridge;
  }
}

const INSPECTOR_TOGGLE_BUTTON_TITLE = '开启组件定位器';
const INSPECT_MODE_ATTRIBUTE = 'data-design-system-inspect-mode';
const INSPECT_MODE_EVENT = 'gettokens:design-system-inspect';

let isInspectModeActive = false;

export function initDesignSystemInspectMode() {
  initInspector();

  window.__gettokensDesignSystemInspector = {
    start: startDesignSystemInspectMode,
  };

  window.addEventListener(INSPECT_MODE_EVENT, () => {
    startDesignSystemInspectMode();
  });
  window.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      setInspectModeActive(false);
    }
  });
  window.addEventListener('click', (event) => {
    if (!isInspectModeActive || isInspectorToggleEvent(event)) {
      return;
    }

    window.setTimeout(() => {
      setInspectModeActive(false);
    }, 700);
  }, true);

  window.requestAnimationFrame(() => {
    attachToggleStateSync();
    if (shouldAutoStartInspectMode()) {
      startDesignSystemInspectMode();
    }
  });
}

function shouldAutoStartInspectMode() {
  return new URLSearchParams(window.location.search).get(DESIGN_SYSTEM_INSPECT_QUERY_PARAM) ===
    DESIGN_SYSTEM_INSPECT_QUERY_VALUE;
}

function startDesignSystemInspectMode() {
  const toggleButton = findInspectorToggleButton();
  if (!toggleButton) {
    return false;
  }

  if (!isInspectModeActive) {
    toggleButton.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
    setInspectModeActive(true);
  }
  return true;
}

function attachToggleStateSync() {
  const toggleButton = findInspectorToggleButton();
  if (!toggleButton || toggleButton.dataset.designSystemInspectToggleBound === 'true') {
    return;
  }

  toggleButton.dataset.designSystemInspectToggleBound = 'true';
  toggleButton.addEventListener('click', () => {
    setInspectModeActive(!isInspectModeActive);
  });
}

function findInspectorToggleButton() {
  return Array.from(document.querySelectorAll('button')).find(
    (button) =>
      button.title === INSPECTOR_TOGGLE_BUTTON_TITLE &&
      button.textContent?.trim() === '🎯',
  ) ?? null;
}

function isInspectorToggleEvent(event: MouseEvent) {
  const target = event.target instanceof Element ? event.target : null;
  const toggleButton = findInspectorToggleButton();
  return !!target && !!toggleButton && (target === toggleButton || toggleButton.contains(target));
}

function setInspectModeActive(isActive: boolean) {
  isInspectModeActive = isActive;
  if (isActive) {
    document.documentElement.setAttribute(INSPECT_MODE_ATTRIBUTE, 'active');
    return;
  }
  document.documentElement.removeAttribute(INSPECT_MODE_ATTRIBUTE);
}
