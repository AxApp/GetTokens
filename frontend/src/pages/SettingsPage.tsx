import SettingsFeature from '../features/settings/SettingsFeature';
import type { ReleaseInfo, SidecarStatus } from '../types';

interface SettingsPageProps {
  version: string;
  releaseLabel: string;
  sidecarStatus: SidecarStatus;
  canApplyUpdate: boolean;
  usesNativeUpdaterUI: boolean;
  availableRelease: ReleaseInfo | null;
  setAvailableRelease: (release: ReleaseInfo | null) => void;
}

export default function SettingsPage(props: SettingsPageProps) {
  return <SettingsFeature {...props} />;
}
