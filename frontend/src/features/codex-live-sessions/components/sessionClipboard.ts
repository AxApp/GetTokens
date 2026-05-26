export const SESSION_ID_COPY_RESET_MS = 1500;

export async function copyCodexLiveSessionID(
  sessionID: string,
  options: {
    writeText?: (value: string) => Promise<void>;
  },
): Promise<boolean> {
  const value = sessionID.trim();
  if (!value || !options.writeText) {
    return false;
  }

  await options.writeText(value);
  return true;
}
