import type { ReleaseInfo } from '../../types';

export const getTokensGitHubRepositoryURL = 'https://github.com/AxApp/GetTokens';
export const cliProxyApiGitHubRepositoryURL = 'https://github.com/AxApp/CLIProxyAPI';

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

export function buildGitHubCommitURL(repositoryURL: string, gitHash: string): string {
  const normalizedHash = gitHash.trim();
  if (!normalizedHash || normalizedHash === 'DEV' || normalizedHash === '—') {
    return '';
  }
  if (!/^[0-9a-f]{7,40}$/i.test(normalizedHash)) {
    return '';
  }

  return `${repositoryURL.replace(/\/$/, '')}/commit/${encodeURIComponent(normalizedHash)}`;
}

export function buildGetTokensReleaseURL(currentVersion: string, checkedReleaseURL = ''): string {
  const normalizedCheckedReleaseURL = checkedReleaseURL.trim();
  if (normalizedCheckedReleaseURL) {
    return normalizedCheckedReleaseURL;
  }

  const normalizedVersion = currentVersion.trim();
  if (!normalizedVersion || normalizedVersion === 'DEV' || normalizedVersion === '—') {
    return '';
  }

  const tag = normalizedVersion.startsWith('v') ? normalizedVersion : `v${normalizedVersion}`;
  return `${getTokensGitHubRepositoryURL}/releases/tag/${encodeURIComponent(tag)}`;
}
