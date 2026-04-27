import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CreateOpenAICompatibleProvider,
  DeleteOpenAICompatibleProvider,
  ListOpenAICompatibleProviders,
  UpdateOpenAICompatibleProvider,
  VerifyOpenAICompatibleProvider,
} from '../../../../wailsjs/go/main/App';
import { toErrorMessage } from '../../../utils/error';
import type { TrackRequest, Translator } from '../model/types';
import {
  buildOpenAICompatibleProviderDraft,
  emptyOpenAICompatibleProviderForm,
  type OpenAICompatibleProvider,
  type OpenAICompatibleProviderDraft,
  type OpenAICompatibleProviderFormState,
  type ProviderVerifyState,
  renameProviderVerifyState,
} from '../model/openAICompatible';

interface UseOpenAICompatibleStateArgs {
  ready: boolean;
  trackRequest: TrackRequest;
  t: Translator;
}

export default function useOpenAICompatibleState({ ready, trackRequest, t }: UseOpenAICompatibleStateArgs) {
  const [providers, setProviders] = useState<OpenAICompatibleProvider[]>([]);
  const [loading, setLoading] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [form, setForm] = useState<OpenAICompatibleProviderFormState>(emptyOpenAICompatibleProviderForm);
  const [formError, setFormError] = useState('');
  const [verifyStateByName, setVerifyStateByName] = useState<Record<string, ProviderVerifyState>>({});
  const [pendingDeleteName, setPendingDeleteName] = useState<string | null>(null);
  const [detailDraft, setDetailDraft] = useState<OpenAICompatibleProviderDraft | null>(null);
  const [detailError, setDetailError] = useState('');
  const [detailSaving, setDetailSaving] = useState(false);

  const loadProviders = useCallback(async () => {
    if (!ready) {
      return;
    }
    setLoading(true);
    try {
      const result = await trackRequest('ListOpenAICompatibleProviders', { args: [] }, () => ListOpenAICompatibleProviders());
      setProviders(result || []);
    } finally {
      setLoading(false);
    }
  }, [ready, trackRequest]);

  useEffect(() => {
    if (ready) {
      void loadProviders();
    }
  }, [loadProviders, ready]);

  const openCreateModal = useCallback(() => {
    setForm(emptyOpenAICompatibleProviderForm);
    setFormError('');
    setIsCreateModalOpen(true);
  }, []);

  const openDetailModal = useCallback((provider: OpenAICompatibleProvider) => {
    setDetailDraft(buildOpenAICompatibleProviderDraft(provider, verifyStateByName[provider.name]));
    setDetailError('');
  }, [verifyStateByName]);

  const closeDetailModal = useCallback(() => {
    setDetailDraft(null);
    setDetailError('');
  }, []);

  const submitCreate = useCallback(async () => {
    try {
      setFormError('');
      await trackRequest('CreateOpenAICompatibleProvider', { ...form }, () =>
        CreateOpenAICompatibleProvider({
          name: form.name,
          baseUrl: form.baseUrl,
          prefix: form.prefix,
          apiKey: form.apiKey,
        }),
      );
      setIsCreateModalOpen(false);
      setForm(emptyOpenAICompatibleProviderForm);
      await loadProviders();
    } catch (error) {
      setFormError(toErrorMessage(error));
    }
  }, [form, loadProviders, trackRequest]);

  const deleteProvider = useCallback(
    async (name: string) => {
      try {
        setPendingDeleteName(name);
        await trackRequest('DeleteOpenAICompatibleProvider', { name }, () => DeleteOpenAICompatibleProvider(name));
        await loadProviders();
        setVerifyStateByName((prev) => {
          const next = { ...prev };
          delete next[name];
          return next;
        });
      } finally {
        setPendingDeleteName(null);
      }
    },
    [loadProviders, trackRequest],
  );

  const saveDetail = useCallback(async () => {
    if (!detailDraft) {
      return;
    }

    try {
      setDetailSaving(true);
      setDetailError('');
      await trackRequest('UpdateOpenAICompatibleProvider', { ...detailDraft }, () =>
        UpdateOpenAICompatibleProvider({
          currentName: detailDraft.currentName,
          name: detailDraft.name,
          baseUrl: detailDraft.baseUrl,
          prefix: detailDraft.prefix,
          apiKey: detailDraft.apiKey,
        }),
      );

      setVerifyStateByName((prev) => renameProviderVerifyState(prev, detailDraft.currentName, detailDraft.name));
      await loadProviders();
      setDetailDraft((prev) =>
        prev
          ? {
              ...prev,
              currentName: prev.name,
            }
          : prev,
      );
    } catch (error) {
      setDetailError(toErrorMessage(error));
    } finally {
      setDetailSaving(false);
    }
  }, [detailDraft, loadProviders, trackRequest]);

  const verifyDetail = useCallback(async () => {
    if (!detailDraft) {
      return;
    }

    const providerName = detailDraft.currentName || detailDraft.name;
    const model = String(detailDraft.verifyModel || '').trim();
    if (!model) {
      setVerifyStateByName((prev) => ({
        ...prev,
        [providerName]: {
          model: '',
          status: 'error',
          message: t('accounts.openai_provider_test_model_required'),
          lastVerifiedAt: prev[providerName]?.lastVerifiedAt ?? null,
        },
      }));
      return;
    }

    setVerifyStateByName((prev) => ({
      ...prev,
      [providerName]: {
        model,
        status: 'loading',
        message: '',
        lastVerifiedAt: prev[providerName]?.lastVerifiedAt ?? null,
      },
    }));

    try {
      const result = await trackRequest(
        'VerifyOpenAICompatibleProvider',
        { name: providerName, baseUrl: detailDraft.baseUrl, model },
        () =>
          VerifyOpenAICompatibleProvider({
            baseUrl: detailDraft.baseUrl,
            apiKey: detailDraft.apiKey,
            model,
          }),
      );

      setVerifyStateByName((prev) => ({
        ...prev,
        [providerName]: {
          model,
          status: result.success ? 'success' : 'error',
          message: result.message || (result.success ? t('accounts.openai_provider_test_success') : t('accounts.openai_provider_test_failed')),
          lastVerifiedAt: Date.now(),
        },
      }));
    } catch (error) {
      setVerifyStateByName((prev) => ({
        ...prev,
        [providerName]: {
          model,
          status: 'error',
          message: toErrorMessage(error),
          lastVerifiedAt: Date.now(),
        },
      }));
    }
  }, [detailDraft, t, trackRequest]);

  const verifyStates = useMemo(() => verifyStateByName, [verifyStateByName]);

  return {
    providers,
    loading,
    isCreateModalOpen,
    form,
    formError,
    verifyStates,
    pendingDeleteName,
    detailDraft,
    detailError,
    detailSaving,
    setForm,
    setIsCreateModalOpen,
    setDetailDraft,
    openCreateModal,
    openDetailModal,
    closeDetailModal,
    submitCreate,
    saveDetail,
    deleteProvider,
    verifyDetail,
    loadProviders,
  };
}
