import { Power } from 'lucide-react';
import { Button, Tag, Divider, Tabs, Tooltip } from 'antd';
import { GetTokensExtensionRegistryExtensionView } from './model';

interface ExtensionDetailModalProps {
  extension: GetTokensExtensionRegistryExtensionView | null;
  mutatingExtensionID: string;
  onSetEnabled: (extensionID: string, enabled: boolean) => void | Promise<void>;
  onClose: () => void;
}

const extensionRegistryPanelClass = 'rounded border border-[var(--gt-border-subtle)] bg-[var(--gt-surface-canvas)]';
const extensionRegistryMutedPanelClass = 'rounded border border-[var(--gt-border-subtle)] bg-[var(--gt-surface-muted)]';
const extensionRegistryTinyMetaClass = 'text-[length:var(--gt-font-size-2xs)] font-normal text-[var(--gt-ink-muted)]';
const codexSkillModalPanelClass = 'rounded border border-[var(--gt-border-subtle)] bg-[var(--gt-surface-canvas)] shadow-xl';
const codexSkillModalHeaderClass = 'border-b border-[var(--gt-border-subtle)] bg-[var(--gt-surface-muted)]';

export default function ExtensionDetailModal({
  extension,
  mutatingExtensionID,
  onSetEnabled,
  onClose,
}: ExtensionDetailModalProps) {
  if (!extension) {
    return null;
  }

  // 基础信息与权限 Tab 的内容
  const overviewContent = (
    <div className="grid gap-6 md:grid-cols-[1fr_1.2fr]">
      <div className="flex flex-col gap-4">
        <div className={`${extensionRegistryPanelClass} px-4 py-4`}>
          <h4 className="m-0 mb-3.5 text-[length:var(--gt-font-size-xs)] font-semibold text-[var(--gt-ink-muted)]">
            基本元数据
          </h4>
          <div className="grid gap-2 text-[length:var(--gt-font-size-xs)]">
            <KeyValueRow label="状态" value={extension.state} />
            <KeyValueRow label="启用状态 (Enable State)" value={extension.enableState.label} />
            <KeyValueRow label="动作可用性" value={extension.actionAvailability.label} />
            <KeyValueRow label="安装根目录 (Root)" value={extension.rootID} />
            <KeyValueRow label="清单路径" value={extension.manifestPath} monospace />
            <KeyValueRow label="代码源 (Source)" value={extension.sourceURI || extension.sourceType || 'local'} monospace />
          </div>
        </div>

        <div className={`${extensionRegistryPanelClass} px-4 py-4`}>
          <h4 className="m-0 mb-3 text-[length:var(--gt-font-size-xs)] font-semibold text-[var(--gt-ink-muted)]">
            声明的权限 (Permissions)
          </h4>
          {extension.permissions.length === 0 ? (
            <div className="text-[length:var(--gt-font-size-xs)] text-[var(--gt-ink-muted)] font-normal">
              无权限声明
            </div>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {extension.permissions.map((perm) => (
                <Tag key={perm} className="m-0 border-[var(--gt-border-subtle)] bg-[var(--gt-surface-muted)] text-[var(--gt-ink-muted)] font-mono text-[length:var(--gt-font-size-2xs)]">
                  {perm}
                </Tag>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-4">
        {extension.enableState.reasons.length > 0 && (
          <div className={`${extensionRegistryPanelClass} px-4 py-4`}>
            <h4 className="m-0 mb-3 text-[length:var(--gt-font-size-xs)] font-semibold text-[var(--gt-ink-muted)]">
              Enable State Reasons
            </h4>
            <div className="grid gap-2">
              {extension.enableState.reasons.map((reason) => (
                <ReasonRow key={`enable-${reason.code}`} reason={reason} />
              ))}
            </div>
          </div>
        )}

        {extension.actionAvailability.reasons.length > 0 && (
          <div className={`${extensionRegistryPanelClass} px-4 py-4`}>
            <h4 className="m-0 mb-3 text-[length:var(--gt-font-size-xs)] font-semibold text-[var(--gt-ink-muted)]">
              Action Availability Reasons
            </h4>
            <div className="grid gap-2">
              {extension.actionAvailability.reasons.map((reason) => (
                <ReasonRow key={`action-${reason.code}`} reason={reason} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );

  // 能力项 Tab 的内容
  const capabilitiesContent = (
    <div className="grid gap-4 max-h-[30rem] overflow-y-auto pr-1">
      {extension.capabilities.length === 0 ? (
        <div className="rounded border border-dashed border-[var(--gt-border-subtle)] p-6 text-center text-[length:var(--gt-font-size-xs)] text-[var(--gt-ink-muted)]">
          无声明能力
        </div>
      ) : (
        extension.capabilities.map((capability) => (
          <div
            key={capability.id || capability.kind}
            className={`${extensionRegistryPanelClass} px-4 py-3`}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="font-mono text-[length:var(--gt-font-size-xs)] font-semibold text-[var(--gt-ink-primary)]">
                  {capability.id || capability.kind}
                </div>
                <div
                  data-gettokens-extension-registry-capability-kind={capability.kind}
                  className="mt-0.5 text-[length:var(--gt-font-size-2xs)] font-normal text-[var(--gt-ink-muted)]"
                >
                  {capability.kind} / {capability.state}
                </div>
              </div>
              <Tag className="m-0 text-[length:var(--gt-font-size-2xs)] border-[var(--gt-border-subtle)] bg-[var(--gt-surface-muted)] text-[var(--gt-ink-muted)]">
                {capability.declaredContributions.length} contributions
              </Tag>
            </div>

            <Divider className="my-2.5 border-[var(--gt-border-subtle)]" />

            <div className="grid gap-1.5 text-[length:var(--gt-font-size-xs)]">
              <KeyValueRow label="Required Permissions" value={capability.requiredPermissions.join(', ') || '-'} monospace />
              <KeyValueRow label="Declared Contributions" value={capability.declaredContributions.join(', ') || '-'} monospace />
            </div>

            {capability.diagnostics.length > 0 && (
              <div className="mt-3 grid gap-2 border-t border-dashed border-[var(--gt-border-subtle)] pt-2.5">
                <div className="text-[length:var(--gt-font-size-2xs)] font-semibold text-[var(--gt-status-danger)]">诊断详情</div>
                {capability.diagnostics.map((diagnostic, index) => (
                  <DiagnosticRow
                    key={`${capability.id || capability.kind}-${diagnostic.code}-${index}`}
                    diagnostic={diagnostic}
                  />
                ))}
              </div>
            )}
          </div>
        ))
      )}
    </div>
  );

  // 运行诊断 Tab 的内容
  const diagnosticsContent = (
    <div className="grid gap-3 max-h-[30rem] overflow-y-auto pr-1">
      {extension.diagnostics.length === 0 ? (
        <div className="rounded border border-dashed border-[var(--gt-border-subtle)] p-8 text-center text-[length:var(--gt-font-size-xs)] text-[var(--gt-ink-muted)]">
          未发现运行诊断异常
        </div>
      ) : (
        extension.diagnostics.map((diagnostic, index) => (
          <DiagnosticRow key={`${diagnostic.code}-${index}`} diagnostic={diagnostic} />
        ))
      )}
    </div>
  );
  const tabs = [
    {
      key: 'overview',
      label: '基本信息与权限',
      children: <div className="pt-2">{overviewContent}</div>,
    },
    {
      key: 'capabilities',
      label: `能力描述 (${extension.capabilities.length})`,
      children: <div className="pt-2">{capabilitiesContent}</div>,
    },
    {
      key: 'diagnostics',
      label: `运行诊断 (${extension.diagnosticCount})`,
      children: <div className="pt-2">{diagnosticsContent}</div>,
    },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden bg-[var(--overlay-scrim-80)] px-4 py-6 sm:px-6 sm:py-8"
      onClick={onClose}
      data-gettokens-extension-registry-selected="true"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={extension.name}
        className={`${codexSkillModalPanelClass} flex h-[calc(100vh-4rem)] max-h-[46rem] w-full max-w-4xl flex-col overflow-hidden`}
        onClick={(event) => event.stopPropagation()}
      >
        <header className={`${codexSkillModalHeaderClass} flex shrink-0 items-center justify-between gap-4 px-6 py-4`}>
          <div className="min-w-0">
            <h2 className="m-0 truncate text-[length:var(--gt-font-size-lg)] font-semibold text-[var(--gt-ink-primary)]">
              {extension.name}
            </h2>
            <div className="mt-1 font-mono text-[length:var(--gt-font-size-xs)] font-normal text-[var(--gt-ink-muted)]">
              {extension.id || 'missing-id'} / {extension.version}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <ExtensionEnableActionButton
              extension={extension}
              busy={mutatingExtensionID === extension.id}
              onSetEnabled={onSetEnabled}
            />
            <Button size="small" data-gettokens-extension-detail-close="true" onClick={onClose}>
              关闭
            </Button>
          </div>
        </header>

        <main className="scrollbar-stable min-h-0 flex-1 overflow-auto p-6 bg-[var(--gt-surface-canvas)]">
          <Tabs defaultActiveKey="overview" size="small" type="card" className="h-full" items={tabs} />
        </main>
      </div>
    </div>
  );
}

function ExtensionEnableActionButton({
  extension,
  busy,
  onSetEnabled,
}: {
  extension: GetTokensExtensionRegistryExtensionView;
  busy: boolean;
  onSetEnabled: (extensionID: string, enabled: boolean) => void | Promise<void>;
}) {
  const action = extension.actionAvailability.action;
  if (!action) {
    return (
      <Button
        size="small"
        disabled
        data-gettokens-extension-enable-action="disabled"
        icon={<Power className="h-3.5 w-3.5" strokeWidth={2.5} />}
        className="inline-flex h-8 items-center justify-center gap-2 rounded border border-dashed border-[var(--gt-border-subtle)] px-2.5 text-[length:var(--gt-font-size-xs)] font-normal text-[var(--gt-ink-muted)]"
      >
        Disabled
      </Button>
    );
  }

  const enabled = action === 'enable';
  return (
    <Button
      type="primary"
      size="small"
      disabled={busy}
      data-gettokens-extension-enable-action={action}
      onClick={(event) => {
        event.stopPropagation();
        void onSetEnabled(extension.id, enabled);
      }}
      icon={<Power className="h-3.5 w-3.5" strokeWidth={2.5} />}
      className="gap-2 disabled:cursor-wait"
      title="Only writes the GetTokens app-local enable-state file. Codex config and capabilities are untouched."
    >
      {busy ? 'Updating' : extension.actionAvailability.label}
    </Button>
  );
}

function KeyValueRow({
  label,
  value,
  monospace,
}: {
  label: string;
  value: string;
  monospace?: boolean;
}) {
  const shortValue = monospace && value.length > 38 ? `...${value.slice(-35)}` : value;
  const needTooltip = monospace && value.length > 38;

  const renderedValue = (
    <div className={monospace ? 'font-mono text-[var(--gt-ink-muted)] truncate max-w-[20rem] select-all' : 'text-[var(--gt-ink-muted)]'}>
      {shortValue}
    </div>
  );

  return (
    <div className="flex items-center justify-between gap-3 py-1 border-b border-dashed border-[color-mix(in_srgb,var(--gt-border-subtle)_40%,transparent)] last:border-0">
      <div className="font-semibold text-[var(--gt-ink-primary)]">{label}</div>
      {needTooltip ? (
        <Tooltip title={value} placement="left">
          {renderedValue}
        </Tooltip>
      ) : (
        renderedValue
      )}
    </div>
  );
}

function ReasonRow({
  reason,
}: {
  reason: {
    code: string;
    label: string;
    message: string;
  };
}) {
  return (
    <div className={`${extensionRegistryMutedPanelClass} px-3 py-2 text-[length:var(--gt-font-size-xs)]`}>
      <div className="flex items-center justify-between gap-3">
        <div className="font-mono text-[length:var(--gt-font-size-2xs)] font-semibold text-[var(--gt-ink-primary)]">
          {reason.code}
        </div>
        <div className={extensionRegistryTinyMetaClass}>
          {reason.label}
        </div>
      </div>
      <div className="mt-1 text-[var(--gt-ink-primary)] leading-normal">{reason.message}</div>
    </div>
  );
}

function DiagnosticRow({
  diagnostic,
}: {
  diagnostic: {
    severity: string;
    code: string;
    path: string;
    message: string;
    source: string;
    scope: string;
  };
}) {
  const shortPath = diagnostic.path.length > 30 ? `...${diagnostic.path.slice(-27)}` : diagnostic.path;

  return (
    <div
      data-gettokens-extension-registry-diagnostic={diagnostic.code}
      className={`${extensionRegistryMutedPanelClass} px-3 py-2.5 text-[length:var(--gt-font-size-xs)]`}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="font-mono text-[length:var(--gt-font-size-2xs)] font-semibold text-[var(--gt-ink-primary)]">
          {diagnostic.code}
        </div>
        <Tag className="m-0 text-[length:var(--gt-font-size-2xs)] border-[var(--gt-border-subtle)] bg-[var(--gt-surface-canvas)] text-[var(--gt-ink-muted)]">
          {diagnostic.scope} / {diagnostic.severity}
        </Tag>
      </div>
      <div className="mt-1 text-[var(--gt-ink-primary)] leading-normal">{diagnostic.message}</div>
      {diagnostic.path && (
        <div className="mt-1.5 font-mono text-[length:var(--gt-font-size-2xs)] text-[var(--gt-ink-muted)]">
          Path:{' '}
          <Tooltip title={diagnostic.path} placement="top">
            <span className="cursor-help">{shortPath}</span>
          </Tooltip>
        </div>
      )}
      {diagnostic.source && (
        <div className="mt-0.5 font-mono text-[length:var(--gt-font-size-2xs)] text-[var(--gt-ink-muted)] truncate select-all" title={diagnostic.source}>
          Source: {diagnostic.source}
        </div>
      )}
    </div>
  );
}
