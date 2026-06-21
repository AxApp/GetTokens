import { Settings2, X } from 'lucide-react';
import { useState } from 'react';
import ModalFrame from '../../../components/ui/ModalFrame';
import type {
  ChannelID,
  ChannelRoutingParticipantAccountLike,
  ProjectCandidatePoolProjectOption,
  ProjectCandidatePoolRuleLike,
} from '../model/channelRouting';
import ProjectCandidatePoolRulesPanel, { type ProjectCandidatePoolRulesAPI } from './ProjectCandidatePoolRulesPanel';

interface ProjectCandidatePoolRulesModalProps {
  channel: ChannelID;
  rules: ProjectCandidatePoolRuleLike[];
  projectOptions: ProjectCandidatePoolProjectOption[];
  accounts: ChannelRoutingParticipantAccountLike[];
  disabled?: boolean;
  saving?: boolean;
  api?: ProjectCandidatePoolRulesAPI;
  onClose: () => void;
  onRulesChange: (rules: ProjectCandidatePoolRuleLike[]) => void;
  onPreviewRule?: (rule: ProjectCandidatePoolRuleLike) => void;
}

const projectCandidateRulesModalButtonClass =
  'inline-flex min-h-9 items-center justify-center gap-2 rounded border border-[var(--gt-border-subtle)] bg-[var(--gt-surface-canvas)] px-3 py-1.5 text-[length:var(--gt-font-size-sm)] font-semibold text-[var(--gt-ink-primary)] transition-colors hover:border-[var(--gt-ink-primary)]';

export default function ProjectCandidatePoolRulesModal({
  channel,
  rules,
  projectOptions,
  accounts,
  disabled = false,
  saving = false,
  api,
  onClose,
  onRulesChange,
  onPreviewRule,
}: ProjectCandidatePoolRulesModalProps) {
  const [primaryActionSlot, setPrimaryActionSlot] = useState<HTMLDivElement | null>(null);

  return (
    <ModalFrame
      onClose={onClose}
      size="detail"
      coverViewport
      ariaLabel="项目配置"
      header={
        <div className="flex min-w-0 items-center justify-between gap-3" data-project-candidate-rules-modal-header>
          <div className="flex min-w-0 items-center gap-2">
            <Settings2 className="h-4 w-4 shrink-0 text-[var(--gt-ink-secondary)]" strokeWidth={3} />
            <div className="min-w-0">
              <h2 className="text-[length:var(--gt-font-size-lg)] font-semibold leading-5 text-[var(--gt-ink-primary)]">
                项目配置
              </h2>
              <p className="mt-1 text-[length:var(--gt-font-size-xs)] leading-5 text-[var(--gt-ink-secondary)]">
                账号候选池规则
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <div ref={setPrimaryActionSlot} className="flex shrink-0 items-center" />
            <button
              type="button"
              onClick={onClose}
              aria-label="关闭项目配置"
              className={projectCandidateRulesModalButtonClass}
            >
              <X className="h-3.5 w-3.5" strokeWidth={3} />
              关闭
            </button>
          </div>
        </div>
      }
      bodyClassName="flex min-h-0 flex-col overflow-x-hidden p-4 sm:p-5"
    >
      <ProjectCandidatePoolRulesPanel
        channel={channel}
        rules={rules}
        projectOptions={projectOptions}
        accounts={accounts}
        disabled={disabled}
        saving={saving}
        api={api}
        onRulesChange={onRulesChange}
        onPreviewRule={onPreviewRule}
        primaryActionSlot={primaryActionSlot}
      />
    </ModalFrame>
  );
}
