const defaultBuildGitHashFallback = 'DEV';

export function formatBuildGitHash(value: unknown, fallback = defaultBuildGitHashFallback): string {
  const normalized = typeof value === 'string' ? value.trim() : '';
  if (!normalized) {
    return fallback;
  }

  return normalized.length > 12 ? normalized.slice(0, 12) : normalized;
}

const buildEnv = (import.meta as ImportMeta & { env?: { VITE_GIT_HASH?: string } }).env;

export const buildGitHashLabel = formatBuildGitHash(buildEnv?.VITE_GIT_HASH);
