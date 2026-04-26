interface PriorityAccountLike {
  id: string;
  priority?: number;
}

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
