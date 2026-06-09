export interface ClipboardWriteOptions {
  navigatorClipboard?: {
    writeText?: (value: string) => Promise<void>;
  };
  runtimeClipboardSetText?: (value: string) => Promise<boolean>;
  documentRef?: ClipboardDocumentRef;
  storageRef?: ClipboardStorageRef;
}

export interface ClipboardReadOptions {
  navigatorClipboard?: {
    readText?: () => Promise<string>;
  };
  runtimeClipboardGetText?: () => Promise<string>;
  storageRef?: ClipboardStorageRef;
}

type ClipboardDocumentRef = Pick<Document, 'addEventListener' | 'removeEventListener'> & {
  execCommand?: (command: string) => boolean;
  createElement?: Document['createElement'];
  body?: Pick<HTMLElement, 'appendChild' | 'removeChild'>;
  activeElement?: Element | null;
};

type ClipboardStorageRef = Pick<Storage, 'getItem' | 'setItem'>;

const accountCardClipboardStorageKey = 'gettokens.account-card.clipboard.v1';

export async function writeAccountClipboardText(value: string, options: ClipboardWriteOptions = {}) {
  const text = String(value ?? '');
  const errors: unknown[] = [];
  const documentRef = options.documentRef ?? (typeof document !== 'undefined' ? document : undefined);
  if (documentRef?.execCommand && tryDocumentClipboardCopy(documentRef, text, errors)) {
    return;
  }

  const navigatorClipboard =
    options.navigatorClipboard ?? (typeof navigator !== 'undefined' ? navigator.clipboard : undefined);
  if (navigatorClipboard?.writeText) {
    try {
      await navigatorClipboard.writeText(text);
      return;
    } catch (error) {
      errors.push(error);
    }
  }

  const runtimeClipboardSetText =
    options.runtimeClipboardSetText ??
    (typeof window !== 'undefined' ? (window as unknown as { runtime?: { ClipboardSetText?: (value: string) => Promise<boolean> } }).runtime?.ClipboardSetText : undefined);
  if (runtimeClipboardSetText) {
    try {
      const copied = await runtimeClipboardSetText(text);
      if (copied) {
        return;
      }
      errors.push(new Error('Wails clipboard returned false.'));
    } catch (error) {
      errors.push(error);
    }
  }

  if (writeAccountClipboardFallback(text, options.storageRef, errors)) {
    return;
  }

  throwClipboardError(errors);
}

export function readAccountClipboardFallback(storageRef: ClipboardStorageRef | undefined = resolveClipboardStorage()): string {
  try {
    return storageRef?.getItem(accountCardClipboardStorageKey) || '';
  } catch {
    return '';
  }
}

export async function readAccountClipboardText(options: ClipboardReadOptions = {}): Promise<string> {
  const navigatorClipboard =
    options.navigatorClipboard ?? (typeof navigator !== 'undefined' ? navigator.clipboard : undefined);
  if (navigatorClipboard?.readText) {
    try {
      const text = await navigatorClipboard.readText();
      if (text) {
        return text;
      }
    } catch {
      // Browser previews often deny readText(); fall through to app/runtime fallbacks.
    }
  }

  const runtimeClipboardGetText =
    options.runtimeClipboardGetText ??
    (typeof window !== 'undefined' ? (window as unknown as { runtime?: { ClipboardGetText?: () => Promise<string> } }).runtime?.ClipboardGetText : undefined);
  if (runtimeClipboardGetText) {
    try {
      const text = await runtimeClipboardGetText();
      if (text) {
        return text;
      }
    } catch {
      // Keep paste UI actionable even if a runtime bridge is unavailable.
    }
  }

  const fallbackText = readAccountClipboardFallback(options.storageRef);
  if (fallbackText) {
    return fallbackText;
  }
  return '';
}

function tryDocumentClipboardCopy(documentRef: ClipboardDocumentRef, text: string, errors: unknown[]): boolean {
  const execCommand = documentRef.execCommand;
  if (!execCommand) {
    return false;
  }
  let eventHandled = false;
  const handleCopy = (event: ClipboardEvent) => {
    event.clipboardData?.setData('text/plain', text);
    event.preventDefault();
    eventHandled = true;
  };
  const textArea = createFallbackTextArea(documentRef, text);
  documentRef.addEventListener('copy', handleCopy);
  let commandSucceeded = false;
  try {
    textArea?.focus();
    textArea?.select();
    commandSucceeded = execCommand.call(documentRef, 'copy');
  } finally {
    documentRef.removeEventListener('copy', handleCopy);
    if (textArea) {
      documentRef.body?.removeChild(textArea);
    }
  }
  if (!commandSucceeded || (!eventHandled && !textArea)) {
    errors.push(new Error('Clipboard copy failed.'));
    return false;
  }
  return true;
}

function createFallbackTextArea(documentRef: ClipboardDocumentRef, text: string): HTMLTextAreaElement | null {
  if (!documentRef.createElement || !documentRef.body) {
    return null;
  }
  const textArea = documentRef.createElement('textarea');
  textArea.value = text;
  textArea.setAttribute('readonly', '');
  textArea.style.position = 'fixed';
  textArea.style.left = '-9999px';
  textArea.style.top = '0';
  documentRef.body.appendChild(textArea);
  return textArea;
}

function writeAccountClipboardFallback(
  text: string,
  storageRef: ClipboardStorageRef | undefined = resolveClipboardStorage(),
  errors: unknown[],
): boolean {
  try {
    storageRef?.setItem(accountCardClipboardStorageKey, text);
    return Boolean(storageRef);
  } catch (error) {
    errors.push(error);
    return false;
  }
}

function resolveClipboardStorage(): ClipboardStorageRef | undefined {
  return typeof window !== 'undefined' ? window.sessionStorage : undefined;
}

function throwClipboardError(errors: unknown[]): never {
  const lastError = errors[errors.length - 1];
  if (lastError instanceof Error) {
    throw lastError;
  }
  throw new Error('Clipboard is unavailable.');
}
