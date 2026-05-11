import RequestOrchestrationFeature from '../features/request-orchestration/RequestOrchestrationFeature';
import type { SidecarStatus } from '../types';

export default function RequestOrchestrationPage({ sidecarStatus }: { sidecarStatus: SidecarStatus }) {
  return <RequestOrchestrationFeature sidecarStatus={sidecarStatus} />;
}
