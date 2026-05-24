import type { ReactNode } from 'react';
import { ExternalLink } from 'lucide-react';

const fieldMetaStyle = { fontSize: 'var(--gt-settings-meta-size, 8px)' } as const;
const bodyTextStyle = { fontSize: 'var(--gt-settings-body-size, 9px)' } as const;
const valueTextStyle = { fontSize: 'var(--gt-settings-value-size, 10px)' } as const;

interface SettingsReleasePanelProps {
  currentVersionTitle: string;
  currentVersionLabel: string;
  releaseLabelTitle: string;
  releaseLabel: string;
  gitHashTitle: string;
  gitHashLabel: string;
  cliProxyApiGitHashTitle: string;
  cliProxyApiGitHashLabel: string;
  latestReleaseTitle: string;
  latestReleaseLabel: string;
  latestReleaseGitHubURL: string;
  updateAssetTitle: string;
  updateAssetName: string;
  updateChannelTitle: string;
  updateChannelHint: ReactNode;
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

export default function SettingsReleasePanel({
  currentVersionTitle,
  currentVersionLabel,
  releaseLabelTitle,
  releaseLabel,
  gitHashTitle,
  gitHashLabel,
  cliProxyApiGitHashTitle,
  cliProxyApiGitHashLabel,
  latestReleaseTitle,
  latestReleaseLabel,
  latestReleaseGitHubURL,
  updateAssetTitle,
  updateAssetName,
  updateChannelTitle,
  updateChannelHint,
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
      className="card-swiss overflow-hidden bg-[var(--bg-surface)] !p-0"
      data-design-system-component="true"
      data-design-system-component-name="SettingsReleasePanel"
      data-design-system-git-hash={gitHashLabel}
    >
      <div className="grid md:grid-cols-[minmax(0,1fr)_17rem]">
        <div className="min-w-0">
          <div className="grid grid-cols-1 border-b border-dashed border-[var(--border-color)] sm:grid-cols-2 lg:grid-cols-4">
            <SettingsReleaseValue
              title={currentVersionTitle}
              value={currentVersionLabel}
              actionURL={currentReleaseGitHubURL}
              actionLabel={openGitHubLabel}
              onOpenURL={onOpenGitHubURL}
              strong
            />
            <SettingsReleaseValue title={releaseLabelTitle} value={releaseLabel} />
            <SettingsReleaseValue
              title={gitHashTitle}
              value={gitHashLabel}
              mono
              actionURL={gitHashGitHubURL}
              actionLabel={openGitHubLabel}
              onOpenURL={onOpenGitHubURL}
            />
            <SettingsReleaseValue
              title={cliProxyApiGitHashTitle}
              value={cliProxyApiGitHashLabel}
              mono
              actionURL={cliProxyApiGitHashGitHubURL}
              actionLabel={openGitHubLabel}
              onOpenURL={onOpenGitHubURL}
            />
          </div>

          <div className="grid grid-cols-1 border-b border-dashed border-[var(--border-color)] sm:grid-cols-2">
            <SettingsReleaseValue
              title={latestReleaseTitle}
              value={latestReleaseLabel}
              actionURL={latestReleaseGitHubURL}
              actionLabel={openGitHubLabel}
              onOpenURL={onOpenGitHubURL}
              strong
            />
            <SettingsReleaseValue title={updateAssetTitle} value={updateAssetName} mono body />
          </div>

          <div className="px-4 py-4">
            <div className="font-bold uppercase tracking-widest text-[var(--text-muted)]" style={fieldMetaStyle}>
              {updateChannelTitle}
            </div>
            <div className="mt-2 font-bold uppercase leading-5 tracking-widest text-[var(--text-primary)]" style={valueTextStyle}>
              {updateChannelHint}
            </div>
            {updateMessage ? (
              <div
                className="mt-3 border border-dashed border-[var(--border-color)] bg-[var(--bg-main)] px-3 py-2 font-bold uppercase leading-5 tracking-widest text-[var(--text-primary)]"
                style={bodyTextStyle}
              >
                {updateMessage}
              </div>
            ) : null}
          </div>
        </div>

        <div className="grid content-start gap-3 border-t border-dashed border-[var(--border-color)] bg-[var(--bg-main)] p-4 md:border-l md:border-t-0">
          <button className="btn-swiss w-full" onClick={onCheckUpdate} disabled={isCheckingUpdate}>
            {isCheckingUpdate ? checkingUpdateLabel : checkUpdateLabel}
          </button>
          {showPrimaryUpdateAction ? (
            <button className="btn-swiss w-full" onClick={onPrimaryUpdateAction} disabled={primaryUpdateDisabled}>
              {primaryUpdateLabel}
            </button>
          ) : null}
          <div className="font-bold uppercase leading-5 tracking-widest text-[var(--text-muted)]" style={fieldMetaStyle}>
            {updateActionHint}
          </div>
        </div>
      </div>
    </div>
  );
}

function SettingsReleaseValue({
  title,
  value,
  mono = false,
  body = false,
  strong = false,
  actionURL = '',
  actionLabel = '',
  onOpenURL,
}: {
  title: string;
  value: string;
  mono?: boolean;
  body?: boolean;
  strong?: boolean;
  actionURL?: string;
  actionLabel?: string;
  onOpenURL?: (url: string) => void;
}) {
  const valueClassName = mono
    ? 'break-all font-mono font-bold text-[var(--text-primary)]'
    : strong
      ? 'font-black uppercase italic text-[var(--text-primary)]'
      : 'font-bold uppercase text-[var(--text-primary)]';

  return (
    <div className="min-w-0 border-b border-dashed border-[var(--border-color)] px-4 py-3 last:border-b-0 sm:border-b-0 sm:border-r sm:last:border-r-0 lg:border-r lg:[&:nth-child(4n)]:border-r-0">
      <div className="flex min-h-6 items-center justify-between gap-2">
        <div className="font-bold uppercase tracking-widest text-[var(--text-muted)]" style={fieldMetaStyle}>
          {title}
        </div>
        {actionURL && onOpenURL ? (
          <button
            type="button"
            className="inline-flex h-6 w-6 shrink-0 items-center justify-center border border-[var(--border-color)] bg-[var(--bg-main)] text-[var(--text-primary)] transition active:scale-95 hover:bg-[var(--bg-surface)]"
            aria-label={`${actionLabel}: ${value}`}
            title={actionLabel}
            onClick={() => onOpenURL(actionURL)}
          >
            <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        ) : null}
      </div>
      <div className={`mt-1 ${valueClassName}`} style={body ? bodyTextStyle : valueTextStyle}>
        {value}
      </div>
    </div>
  );
}
