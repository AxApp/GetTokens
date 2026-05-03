import type { SessionManagementWorkspace } from '../types';
import SessionManagementFeature from '../features/session-management/SessionManagementFeature';

interface SessionManagementPageProps {
  workspace: SessionManagementWorkspace;
}

export default function SessionManagementPage({ workspace }: SessionManagementPageProps) {
  return <SessionManagementFeature workspace={workspace} />;
}
