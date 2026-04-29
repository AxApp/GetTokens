import SessionManagementFeature from '../features/session-management/SessionManagementFeature';
import type { SessionManagementWorkspace } from '../types';

interface SessionManagementPageProps {
  workspace: SessionManagementWorkspace;
}

export default function SessionManagementPage({ workspace }: SessionManagementPageProps) {
  return <SessionManagementFeature workspace={workspace} />;
}
