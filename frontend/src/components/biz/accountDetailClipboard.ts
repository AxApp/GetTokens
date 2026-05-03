export const RAW_CONTENT_COPY_RESET_MS = 1600;

export function canCopyRawContent(value: string, loading: boolean): boolean {
  return !loading && value.trim().length > 0;
}

export async function copyRawContent(
  value: string,
  options: {
    loading: boolean;
    writeText: (nextValue: string) => Promise<void>;
  }
): Promise<'success' | 'error'> {
  if (!canCopyRawContent(value, options.loading)) {
    return 'error';
  }

  try {
    await options.writeText(value);
    return 'success';
  } catch {
    return 'error';
  }
}
