import type { ReactNode } from 'react';
import { Button } from 'antd';
import { ExternalLink } from 'lucide-react';

interface SettingsReleasePanelProps {
  currentVersionTitle: string;
  currentVersionLabel: string;
  gitHashTitle: string;
  gitHashLabel: string;
  cliProxyApiGitHashTitle: string;
  cliProxyApiGitHashLabel: string;
  latestReleaseTitle: string;
  latestReleaseLabel: string;
  latestReleaseGitHubURL: string;
  currentReleaseGitHubURL: string;
  gitHashGitHubURL: string;
  cliProxyApiGitHashGitHubURL: string;
  openGitHubLabel: string;
  onOpenGitHubURL: (url: string) => void;
  updateMessage: string;
  checkUpdateLabel: string;
  checkingUpdateLabel: string;
  isCheckingUpdate: boolean;
  onCheckUpdate: () => void;
  showPrimaryUpdateAction: boolean;
  primaryUpdateLabel: string;
  primaryUpdateDisabled: boolean;
  onPrimaryUpdateAction: () => void;
  updateActionHint: ReactNode;
}

function ReleaseRow({
  label,
  value,
  mono = false,
  actionURL,
  actionLabel,
  onOpenURL,
}: {
  label: string;
  value: string;
  mono?: boolean;
  actionURL?: string;
  actionLabel?: string;
  onOpenURL?: (url: string) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 border-b px-4 py-3 last:border-b-0">
      <div className="min-w-0 flex-1">
        <div className="text-[length:var(--gt-font-size-body)] font-semibold text-[var(--gt-ink-primary)]">{label}</div>
      </div>
      <div className="flex items-center gap-2">
        <span className={`select-text text-[length:var(--gt-font-size-sm)] text-[var(--gt-ink-primary)] ${mono ? 'font-mono' : 'font-sans'}`}>
          {value}
        </span>
        {actionURL && onOpenURL ? (
          <Button
            size="small"
            type="text"
            icon={<ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />}
            aria-label={`${actionLabel}: ${value}`}
            title={actionLabel}
            onClick={() => onOpenURL(actionURL)}
          />
        ) : null}
      </div>
    </div>
  );
}

export default function SettingsReleasePanel({
  currentVersionTitle,
  currentVersionLabel,
  gitHashTitle,
  gitHashLabel,
  cliProxyApiGitHashTitle,
  cliProxyApiGitHashLabel,
  latestReleaseTitle,
  latestReleaseLabel,
  latestReleaseGitHubURL,
  currentReleaseGitHubURL,
  gitHashGitHubURL,
  cliProxyApiGitHashGitHubURL,
  openGitHubLabel,
  onOpenGitHubURL,
  updateMessage,
  checkUpdateLabel,
  checkingUpdateLabel,
  isCheckingUpdate,
  onCheckUpdate,
  showPrimaryUpdateAction,
  primaryUpdateLabel,
  primaryUpdateDisabled,
  onPrimaryUpdateAction,
  updateActionHint,
}: SettingsReleasePanelProps) {
  return (
    <div
      data-design-system-component="true"
      data-design-system-component-name="SettingsReleasePanel"
      data-design-system-git-hash={gitHashLabel}
    >
      <ReleaseRow
        label={currentVersionTitle}
        value={currentVersionLabel}
        actionURL={currentReleaseGitHubURL}
        actionLabel={openGitHubLabel}
        onOpenURL={onOpenGitHubURL}
      />
      <ReleaseRow
        label={gitHashTitle}
        value={gitHashLabel}
        mono
        actionURL={gitHashGitHubURL}
        actionLabel={openGitHubLabel}
        onOpenURL={onOpenGitHubURL}
      />
      <ReleaseRow
        label={cliProxyApiGitHashTitle}
        value={cliProxyApiGitHashLabel}
        mono
        actionURL={cliProxyApiGitHashGitHubURL}
        actionLabel={openGitHubLabel}
        onOpenURL={onOpenGitHubURL}
      />
      <ReleaseRow
        label={latestReleaseTitle}
        value={latestReleaseLabel}
        actionURL={latestReleaseGitHubURL}
        actionLabel={openGitHubLabel}
        onOpenURL={onOpenGitHubURL}
      />

      {updateMessage ? (
        <div className="px-4 py-3 text-[length:var(--gt-font-size-sm)] text-[var(--gt-status-info)]">
          {updateMessage}
        </div>
      ) : null}

      <div className="flex items-center gap-3 border-t border-[var(--gt-border-subtle)] px-4 py-3">
        <Button
          size="small"
          onClick={onCheckUpdate}
          disabled={isCheckingUpdate}
        >
          {isCheckingUpdate ? checkingUpdateLabel : checkUpdateLabel}
        </Button>
        {showPrimaryUpdateAction ? (
          <Button
            size="small"
            type="primary"
            onClick={onPrimaryUpdateAction}
            disabled={primaryUpdateDisabled}
          >
            {primaryUpdateLabel}
          </Button>
        ) : null}
        <span className="text-[length:var(--gt-font-size-xs)] text-[var(--gt-ink-muted)]">
          {updateActionHint}
        </span>
      </div>
    </div>
  );
}
