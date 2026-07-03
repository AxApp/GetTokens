import UnifiedAccountDetailModal, {
  CodexAccountDetailHeader,
  type UnifiedAccountDetailProps,
} from '../../accounts/components/UnifiedAccountDetailModal';
import type { ApiKeyConfigDraft } from '../../accounts/model/accountDetailConfig';
import type { RateLimitRulesAPI } from '../../accounts/components/RateLimitRulesSection';
import {
  buildCodexQuotaSummaryAccount,
  type CodexAccountRow,
  type CodexModelMappingRow,
} from '../model/codexAccountList';

export { CodexAccountDetailHeader };

export type CodexAccountDetailModalProps = Omit<
  UnifiedAccountDetailProps,
  'account' | 'isCodex' | 'codexRow' | 'onSaveCodexConfig' | 'onSaveConfig' | 'rateLimitRulesAPI'
> & {
  row: CodexAccountRow;
  t?: (key: string) => string;
  rateLimitRulesAPI?: RateLimitRulesAPI;
  onSaveConfig?: (draft: ApiKeyConfigDraft, mappings: CodexModelMappingRow[]) => Promise<void>;
};

export function CodexAccountDetailModal({
  row,
  t: _t,
  rateLimitRulesAPI,
  onSaveConfig,
  ...props
}: CodexAccountDetailModalProps) {
  return (
    <UnifiedAccountDetailModal
      {...props}
      account={buildCodexQuotaSummaryAccount(row)}
      isCodex={true}
      codexRow={row}
      rateLimitRulesAPI={rateLimitRulesAPI}
      onSaveCodexConfig={onSaveConfig}
    />
  );
}

export default CodexAccountDetailModal;
