interface PriorityAccountLike {
  id: string;
  priority?: number;
}

export type RoutingDefaultField =
  | 'strategy'
  | 'sessionAffinity'
  | 'sessionAffinityTTL'
  | 'requestRetry'
  | 'maxRetryCredentials'
  | 'maxRetryInterval'
  | 'switchProject'
  | 'switchPreviewModel'
  | 'antigravityCredits';

export function reorderPriorityAccounts<T extends PriorityAccountLike>(accounts: T[], draggedID: string, targetID: string) {
  if (!draggedID || !targetID || draggedID === targetID) {
    return accounts.slice();
  }

  const next = accounts.slice();
  const draggedIndex = next.findIndex((account) => account.id === draggedID);
  const targetIndex = next.findIndex((account) => account.id === targetID);

  if (draggedIndex < 0 || targetIndex < 0) {
    return next;
  }

  const [dragged] = next.splice(draggedIndex, 1);
  next.splice(targetIndex, 0, dragged);
  return next;
}

export function buildPriorityUpdates<T extends PriorityAccountLike>(accounts: T[]) {
  const highestPriority = accounts.length;

  return accounts
    .map((account, index) => ({
      id: account.id,
      priority: highestPriority - index,
      previousPriority: Number(account.priority || 0),
    }))
    .filter((account) => account.priority !== account.previousPriority)
    .map(({ id, priority }) => ({ id, priority }));
}

export function buildRoutingDefaultLabel(
  t: (key: string) => string,
  field: RoutingDefaultField,
): string {
  const prefix = t('status.default_value');

  switch (field) {
    case 'strategy':
      return `${prefix}: round-robin`;
    case 'sessionAffinityTTL':
      return `${prefix}: 1h`;
    case 'requestRetry':
    case 'maxRetryCredentials':
    case 'maxRetryInterval':
      return `${prefix}: 0`;
    case 'sessionAffinity':
    case 'switchProject':
    case 'switchPreviewModel':
    case 'antigravityCredits':
      return `${prefix}: ${t('status.disabled')}`;
    default:
      return prefix;
  }
}
