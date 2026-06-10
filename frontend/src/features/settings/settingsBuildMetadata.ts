const defaultBuildGitHashFallback = 'DEV';

export function formatBuildGitHash(value: unknown, fallback = defaultBuildGitHashFallback): string {
  const normalized = normalizeBuildGitHash(value);
  if (!normalized) {
    return fallback;
  }

  return normalized.length > 12 ? normalized.slice(0, 12) : normalized;
}

export function normalizeBuildGitHash(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

const buildEnv = (import.meta as ImportMeta & { env?: { VITE_GIT_HASH?: string } }).env;

export const buildGitHashCommit = normalizeBuildGitHash(buildEnv?.VITE_GIT_HASH);
export const buildGitHashLabel = formatBuildGitHash(buildGitHashCommit);
