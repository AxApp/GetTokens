import { getAccountsPreviewCodexAccounts, getAccountsPreviewOpenAICompatibleProviders } from '../accounts/previewData.ts';
import {
  buildCodexAccountRows,
  buildCodexAuthFileModelMappings,
  type CodexAccountRow,
  type CodexModelMappingRow,
} from './model/codexAccountList.ts';

const PREVIEW_AUTH_FILE_MODELS = {
  'auth-file:codex-pro.json': [
    { id: 'gpt-5.4', display_name: 'GPT 5.4' },
    { id: 'gpt-5.4-mini', display_name: 'GPT 5.4 Mini' },
  ],
  'auth-file:codex-team.json': [
    { id: 'gpt-5.4-mini', display_name: 'GPT 5.4 Mini' },
    { id: 'gpt-5.2', display_name: 'GPT 5.2' },
  ],
};

export function getCodexAccountListPreviewRows(): CodexAccountRow[] {
  return buildCodexAccountRows({
    accounts: getAccountsPreviewCodexAccounts(),
    providers: getAccountsPreviewOpenAICompatibleProviders(),
  });
}

export function getCodexAccountListPreviewAuthFileModelOptions(rowID: string): CodexModelMappingRow[] {
  return buildCodexAuthFileModelMappings(PREVIEW_AUTH_FILE_MODELS[rowID as keyof typeof PREVIEW_AUTH_FILE_MODELS] || []);
}
