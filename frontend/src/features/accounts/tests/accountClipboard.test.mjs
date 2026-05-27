import test from 'node:test';
import assert from 'node:assert/strict';

import { readAccountClipboardFallback, writeAccountClipboardText } from '../model/accountClipboard.ts';

test('writeAccountClipboardText uses navigator clipboard when available', async () => {
  const writes = [];
  await writeAccountClipboardText('hello', {
    navigatorClipboard: {
      writeText: async (value) => {
        writes.push(value);
      },
    },
  });

  assert.deepEqual(writes, ['hello']);
});

test('writeAccountClipboardText falls back to Wails runtime clipboard', async () => {
  const writes = [];
  await writeAccountClipboardText('fallback', {
    runtimeClipboardSetText: async (value) => {
      writes.push(value);
      return true;
    },
  });

  assert.deepEqual(writes, ['fallback']);
});

test('writeAccountClipboardText continues to runtime fallback when navigator clipboard rejects', async () => {
  const writes = [];
  await writeAccountClipboardText('runtime-after-reject', {
    navigatorClipboard: {
      writeText: async () => {
        throw new Error('browser denied clipboard');
      },
    },
    runtimeClipboardSetText: async (value) => {
      writes.push(value);
      return true;
    },
  });

  assert.deepEqual(writes, ['runtime-after-reject']);
});

test('writeAccountClipboardText continues to DOM fallback when earlier clipboard adapters fail', async () => {
  let listener;
  const copied = {};
  await writeAccountClipboardText('dom-after-reject', {
    navigatorClipboard: {
      writeText: async () => {
        throw new Error('browser denied clipboard');
      },
    },
    runtimeClipboardSetText: async () => false,
    documentRef: {
      addEventListener: (_event, nextListener) => {
        listener = nextListener;
      },
      removeEventListener: () => {},
      execCommand: () => {
        listener({
          clipboardData: {
            setData: (type, value) => {
              copied[type] = value;
            },
          },
          preventDefault: () => {},
        });
        return true;
      },
    },
  });

  assert.equal(copied['text/plain'], 'dom-after-reject');
});

test('writeAccountClipboardText falls back to DOM copy command', async () => {
  let listener;
  const copied = {};
  await writeAccountClipboardText('dom-copy', {
    documentRef: {
      addEventListener: (_event, nextListener) => {
        listener = nextListener;
      },
      removeEventListener: () => {},
      execCommand: () => {
        listener({
          clipboardData: {
            setData: (type, value) => {
              copied[type] = value;
            },
          },
          preventDefault: () => {},
        });
        return true;
      },
    },
  });

  assert.equal(copied['text/plain'], 'dom-copy');
});

test('writeAccountClipboardText supports textarea-based DOM copy fallback', async () => {
  const appended = [];
  const removed = [];
  const textArea = {
    value: '',
    style: {},
    setAttribute: () => {},
    focus: () => {},
    select: () => {},
  };
  await writeAccountClipboardText('textarea-copy', {
    navigatorClipboard: {
      writeText: async () => {
        throw new Error('browser denied clipboard');
      },
    },
    documentRef: {
      addEventListener: () => {},
      removeEventListener: () => {},
      createElement: () => textArea,
      body: {
        appendChild: (node) => {
          appended.push(node);
          return node;
        },
        removeChild: (node) => {
          removed.push(node);
          return node;
        },
      },
      execCommand: () => true,
    },
  });

  assert.equal(textArea.value, 'textarea-copy');
  assert.deepEqual(appended, [textArea]);
  assert.deepEqual(removed, [textArea]);
});

test('writeAccountClipboardText stores an app-local fallback when clipboard adapters are unavailable', async () => {
  const storage = new Map();
  const storageRef = {
    getItem: (key) => storage.get(key) || null,
    setItem: (key, value) => {
      storage.set(key, value);
    },
  };

  await writeAccountClipboardText('local-copy', {
    navigatorClipboard: {
      writeText: async () => {
        throw new Error('browser denied clipboard');
      },
    },
    runtimeClipboardSetText: async () => false,
    storageRef,
  });

  assert.equal(readAccountClipboardFallback(storageRef), 'local-copy');
});
