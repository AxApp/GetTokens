import StatusFeature from '../features/status/StatusFeature';
import type { SidecarStatus } from '../types';

interface StatusPageProps {
  sidecarStatus?: SidecarStatus;
  version?: string;
}

export default function StatusPage(props: StatusPageProps) {
  return <StatusFeature {...props} />;
}
