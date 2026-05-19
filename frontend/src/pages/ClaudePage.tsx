import ClaudeCodeAccountListFeature from '../features/claude-code/ClaudeCodeAccountListFeature';
import type { ClaudeWorkspace, SidecarStatus } from '../types';

interface ClaudePageProps {
  workspace: ClaudeWorkspace;
  sidecarStatus: SidecarStatus;
}

export default function ClaudePage({ workspace, sidecarStatus }: ClaudePageProps) {
  if (workspace === 'account-list') {
    return <ClaudeCodeAccountListFeature sidecarStatus={sidecarStatus} />;
  }

  return <ClaudeCodeAccountListFeature sidecarStatus={sidecarStatus} />;
}
