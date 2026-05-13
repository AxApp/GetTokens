import { formatBinarySize, type CodexBinaryVersionRowView } from './model';

export function getVersionBrowserURL(row: CodexBinaryVersionRowView): string {
  if (row.htmlURL) {
    return row.htmlURL;
  }
  if (row.sourceID === 'openai-codex-github' && row.tag) {
    return `https://github.com/openai/codex/releases/tag/${encodeURIComponent(row.tag)}`;
  }
  return '';
}

export function formatTaskSize(task: CodexBinaryVersionRowView['task'], assetSize?: number): string {
  if (!task) {
    return '';
  }
  const total = task.bytesTotal || assetSize;
  if (!total) {
    return '';
  }
  const totalLabel = formatBinarySize(total);
  const doneLabel = formatBinarySize(task.bytesDone);
  return doneLabel ? `${doneLabel} / ${totalLabel}` : totalLabel;
}
