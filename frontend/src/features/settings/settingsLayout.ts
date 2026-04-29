export const settingsSectionOrder = [
  'appearance',
  'local_usage_refresh',
  'updates',
] as const;

export type SettingsSectionID = (typeof settingsSectionOrder)[number];

export function getSettingsSectionBadge(sectionID: SettingsSectionID): string {
  const index = settingsSectionOrder.indexOf(sectionID);

  if (index < 0) {
    throw new Error(`Unknown settings section: ${sectionID}`);
  }

  return String(index + 1).padStart(2, '0');
}
