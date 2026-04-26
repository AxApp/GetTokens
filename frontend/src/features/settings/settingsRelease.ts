import type { ReleaseInfo } from '../../types';

export function mapCheckedRelease(result: ReleaseInfo | null | undefined): ReleaseInfo | null {
  if (!result) {
    return null;
  }

  return {
    version: result.version,
    releaseUrl: result.releaseUrl,
    assetName: result.assetName,
    releaseNote: result.releaseNote,
  };
}
