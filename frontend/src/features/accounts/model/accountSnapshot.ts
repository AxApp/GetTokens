export interface AccountSnapshotLoadState {
  ready: boolean;
  loaded: boolean;
  loading: boolean;
}

export function shouldEnsureAccountSnapshot(state: AccountSnapshotLoadState) {
  return state.ready && !state.loaded && !state.loading;
}
