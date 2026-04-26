import SettingsFeature from '../features/settings/SettingsFeature';
import type { ReleaseInfo } from '../types';

interface SettingsPageProps {
  version: string;
  releaseLabel: string;
  canApplyUpdate: boolean;
  availableRelease: ReleaseInfo | null;
  setAvailableRelease: (release: ReleaseInfo | null) => void;
}

export default function SettingsPage(props: SettingsPageProps) {
  return <SettingsFeature {...props} />;
}
