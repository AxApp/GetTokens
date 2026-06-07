import { Settings2, X } from 'lucide-react';
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
  return (
    <ModalFrame
      onClose={onClose}
      size="detail"
      coverViewport
      ariaLabel="项目配置"
      header={
        <div className="flex min-w-0 items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <Settings2 className="h-4 w-4 shrink-0 text-[var(--text-secondary)]" strokeWidth={4} />
            <div className="min-w-0">
              <h2 className="text-[length:var(--font-size-ui-lg)] font-black leading-5 text-[var(--text-primary)]">
                项目配置
              </h2>
              <p className="mt-1 text-[length:var(--font-size-ui-xs)] leading-5 text-[var(--text-secondary)]">
                账号候选池规则
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="关闭项目配置"
            className="btn-swiss flex min-h-9 items-center gap-2 !px-3 !py-1.5 !text-[length:var(--font-size-ui-sm)]"
          >
            <X className="h-3.5 w-3.5" strokeWidth={4} />
            关闭
          </button>
        </div>
      }
      bodyClassName="p-4 sm:p-5"
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
      />
    </ModalFrame>
  );
}
