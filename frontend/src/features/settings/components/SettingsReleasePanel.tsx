import type { ReactNode } from 'react';

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
  updateAssetTitle: string;
  updateAssetName: string;
  updateChannelTitle: string;
  updateChannelHint: ReactNode;
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
  updateAssetTitle,
  updateAssetName,
  updateChannelTitle,
  updateChannelHint,
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
      className="card-swiss bg-[var(--bg-surface)] !p-5"
      data-design-system-component="true"
      data-design-system-component-name="SettingsReleasePanel"
      data-design-system-git-hash={gitHashLabel}
    >
      <div className="grid gap-5 md:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <SettingsReleaseValue title={currentVersionTitle} value={currentVersionLabel} />
            <SettingsReleaseValue title={releaseLabelTitle} value={releaseLabel} />
            <SettingsReleaseValue title={gitHashTitle} value={gitHashLabel} mono />
            <SettingsReleaseValue title={cliProxyApiGitHashTitle} value={cliProxyApiGitHashLabel} mono />
          </div>

          <div className="grid grid-cols-1 gap-4 border-t border-dashed border-[var(--border-color)] pt-4 sm:grid-cols-2">
            <SettingsReleaseValue title={latestReleaseTitle} value={latestReleaseLabel} />
            <SettingsReleaseValue title={updateAssetTitle} value={updateAssetName} mono body />
          </div>

          <div className="border-t border-dashed border-[var(--border-color)] pt-4">
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

        <div className="space-y-3 border-t border-dashed border-[var(--border-color)] pt-4 md:border-l md:border-t-0 md:pl-5 md:pt-0">
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
}: {
  title: string;
  value: string;
  mono?: boolean;
  body?: boolean;
}) {
  const valueClassName = mono
    ? 'break-all font-mono font-bold text-[var(--text-primary)]'
    : 'font-black uppercase italic text-[var(--text-primary)]';

  return (
    <div className="min-w-0 space-y-1">
      <div className="font-bold uppercase tracking-widest text-[var(--text-muted)]" style={fieldMetaStyle}>
        {title}
      </div>
      <div className={valueClassName} style={body ? bodyTextStyle : valueTextStyle}>
        {value}
      </div>
    </div>
  );
}
