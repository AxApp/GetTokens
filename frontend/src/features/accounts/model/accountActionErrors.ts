import type { AccountActionNotice } from './types';

export function buildAccountDisabledActionNotice(nextDisabled: boolean, error: unknown): AccountActionNotice {
  return {
    tone: 'error',
    message: `${nextDisabled ? '禁用账号失败' : '启用账号失败'}：${accountActionErrorMessage(error)}`,
  };
}

function accountActionErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message.trim();
  if (typeof error === 'string') return error.trim();
  if (error && typeof error === 'object' && 'message' in error) {
    return String((error as { message?: unknown }).message || '').trim();
  }
  return String(error || 'unknown error').trim();
}
