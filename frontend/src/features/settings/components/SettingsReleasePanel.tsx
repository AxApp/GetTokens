import type { ReactNode } from 'react';
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
    <div className="parchment-settings-row">
      <div className="min-w-0 flex-1">
        <div className="parchment-settings-row-label">{label}</div>
      </div>
      <div className="flex items-center gap-2">
        <span
          className="text-sm"
          style={{
            color: 'var(--gt-ink-primary)',
            fontFamily: mono ? 'var(--gt-font-family-mono)' : 'var(--gt-font-family-sans)',
            userSelect: 'text',
          }}
        >
          {value}
        </span>
        {actionURL && onOpenURL ? (
          <button
            type="button"
            className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded transition active:scale-95"
            style={{
              border: '1px solid var(--gt-border-default)',
              backgroundColor: 'var(--gt-surface-raised)',
              color: 'var(--gt-ink-secondary)',
            }}
            aria-label={`${actionLabel}: ${value}`}
            title={actionLabel}
            onClick={() => onOpenURL(actionURL)}
          >
            <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
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
        <div className="px-4 py-3 text-sm" style={{ color: 'var(--gt-status-info)' }}>
          {updateMessage}
        </div>
      ) : null}

      <div className="flex items-center gap-3 px-4 py-3" style={{ borderTop: '1px solid var(--gt-border-subtle)' }}>
        <button
          type="button"
          className="parchment-toolbar-action-secondary"
          style={{ minWidth: 'auto', minHeight: 'auto', padding: '0.5rem 1rem', fontSize: 'var(--gt-font-size-body)' }}
          onClick={onCheckUpdate}
          disabled={isCheckingUpdate}
        >
          {isCheckingUpdate ? checkingUpdateLabel : checkUpdateLabel}
        </button>
        {showPrimaryUpdateAction ? (
          <button
            type="button"
            className="parchment-toolbar-action-primary"
            style={{ minWidth: 'auto', minHeight: 'auto', padding: '0.5rem 1rem', fontSize: 'var(--gt-font-size-body)' }}
            onClick={onPrimaryUpdateAction}
            disabled={primaryUpdateDisabled}
          >
            {primaryUpdateLabel}
          </button>
        ) : null}
        <span className="text-xs" style={{ color: 'var(--gt-ink-muted)' }}>
          {updateActionHint}
        </span>
      </div>
    </div>
  );
}
