import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CreateOpenAICompatibleProvider,
  DeleteOpenAICompatibleProvider,
  ListOpenAICompatibleProviders,
  VerifyOpenAICompatibleProvider,
} from '../../../../wailsjs/go/main/App';
import { toErrorMessage } from '../../../utils/error';
import type { TrackRequest, Translator } from '../model/types';
import {
  emptyOpenAICompatibleProviderForm,
  type OpenAICompatibleProvider,
  type OpenAICompatibleProviderFormState,
  type ProviderVerifyState,
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

  const setVerifyModel = useCallback((name: string, model: string) => {
    setVerifyStateByName((prev) => ({
      ...prev,
      [name]: {
        model,
        status: prev[name]?.status ?? 'idle',
        message: prev[name]?.message ?? '',
        lastVerifiedAt: prev[name]?.lastVerifiedAt ?? null,
      },
    }));
  }, []);

  const verifyProvider = useCallback(
    async (provider: OpenAICompatibleProvider) => {
      const current = verifyStateByName[provider.name];
      const model = String(current?.model || '').trim();
      if (!model) {
        setVerifyStateByName((prev) => ({
          ...prev,
          [provider.name]: {
            model: '',
            status: 'error',
            message: t('accounts.openai_provider_test_model_required'),
            lastVerifiedAt: prev[provider.name]?.lastVerifiedAt ?? null,
          },
        }));
        return;
      }

      setVerifyStateByName((prev) => ({
        ...prev,
        [provider.name]: {
          model,
          status: 'loading',
          message: '',
          lastVerifiedAt: prev[provider.name]?.lastVerifiedAt ?? null,
        },
      }));

      try {
        const result = await trackRequest(
          'VerifyOpenAICompatibleProvider',
          { name: provider.name, baseUrl: provider.baseUrl, model },
          () =>
            VerifyOpenAICompatibleProvider({
              baseUrl: provider.baseUrl,
              apiKey: provider.apiKey,
              model,
              headers: provider.headers,
            }),
        );

        setVerifyStateByName((prev) => ({
          ...prev,
          [provider.name]: {
            model,
            status: result.success ? 'success' : 'error',
            message: result.message || (result.success ? t('accounts.openai_provider_test_success') : t('accounts.openai_provider_test_failed')),
            lastVerifiedAt: Date.now(),
          },
        }));
      } catch (error) {
        setVerifyStateByName((prev) => ({
          ...prev,
          [provider.name]: {
            model,
            status: 'error',
            message: toErrorMessage(error),
            lastVerifiedAt: Date.now(),
          },
        }));
      }
    },
    [t, trackRequest, verifyStateByName],
  );

  const verifyStates = useMemo(() => verifyStateByName, [verifyStateByName]);

  return {
    providers,
    loading,
    isCreateModalOpen,
    form,
    formError,
    verifyStates,
    pendingDeleteName,
    setForm,
    setIsCreateModalOpen,
    openCreateModal,
    submitCreate,
    deleteProvider,
    setVerifyModel,
    verifyProvider,
    loadProviders,
  };
}
