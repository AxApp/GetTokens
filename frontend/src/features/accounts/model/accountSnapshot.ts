export interface AccountSnapshotLoadState {
  ready: boolean;
  loaded: boolean;
  loading: boolean;
}

export function shouldEnsureAccountSnapshot(state: AccountSnapshotLoadState) {
  return state.ready && !state.loaded && !state.loading;
}

export interface AccountSkeletonRenderState {
  ready: boolean;
  loaded: boolean;
  accountCount: number;
}

export function shouldShowAccountSkeletons(state: AccountSkeletonRenderState) {
  return !state.ready || (!state.loaded && state.accountCount === 0);
}
