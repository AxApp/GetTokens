export const ACCOUNT_REVISION_CONFLICT_MESSAGE =
  '账号已在其他位置更新，已重新载入最新详情。请确认变更后再次保存。';

export function isAccountRevisionConflictError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error ?? '');
  return message.toLowerCase().includes('account_revision_conflict');
}
