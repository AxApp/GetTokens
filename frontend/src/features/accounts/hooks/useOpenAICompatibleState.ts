import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CreateOpenAICompatibleProvider,
  DeleteOpenAICompatibleProvider,
  FetchOpenAICompatibleProviderModels,
  ListOpenAICompatibleProviders,
  UpdateOpenAICompatibleProvider,
  VerifyOpenAICompatibleProvider,
} from '../../../../wailsjs/go/main/App';
import { main } from '../../../../wailsjs/go/models';
import { toErrorMessage } from '../../../utils/error';
import type { TrackRequest, Translator } from '../model/types';
import {
  applyOpenAICompatibleProviderPreset,
  parseHeadersText,
  buildModelRows,
  buildOpenAICompatibleProviderDraft,
  buildProviderConfigSignature,
  normalizeProviderModels,
  emptyOpenAICompatibleProviderForm,
  type OpenAICompatibleProvider,
  type OpenAICompatibleProviderDraft,
  type OpenAICompatibleProviderFormState,
  type ProviderRemoteModelsState,
  type ProviderVerifyState,
  renameProviderRemoteModelsState,
  renameProviderVerifyState,
  shouldRefreshRemoteModels,
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
  const [selectedPresetID, setSelectedPresetID] = useState('');
  const [form, setForm] = useState<OpenAICompatibleProviderFormState>(emptyOpenAICompatibleProviderForm);
  const [formError, setFormError] = useState('');
  const [verifyStateByName, setVerifyStateByName] = useState<Record<string, ProviderVerifyState>>({});
  const [remoteModelsStateByName, setRemoteModelsStateByName] = useState<Record<string, ProviderRemoteModelsState>>({});
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
    setSelectedPresetID('');
    setForm(emptyOpenAICompatibleProviderForm);
    setFormError('');
    setIsCreateModalOpen(true);
  }, []);

  const applyCreatePreset = useCallback((presetID: string) => {
    setSelectedPresetID(presetID);
    setForm((prev) => applyOpenAICompatibleProviderPreset(prev, presetID));
  }, []);

  const fetchRemoteModelsForDraft = useCallback(
    async (draft: OpenAICompatibleProviderDraft) => {
      const providerName = draft.currentName || draft.name;
      setRemoteModelsStateByName((prev) => ({
        ...prev,
        [providerName]: {
          status: 'loading',
          message: '',
          models: prev[providerName]?.models || [],
          lastFetchedAt: prev[providerName]?.lastFetchedAt ?? null,
          configSignature: buildProviderConfigSignature(draft),
        },
      }));

      try {
        const result = await trackRequest(
          'FetchOpenAICompatibleProviderModels',
          { name: providerName, baseUrl: draft.baseUrl },
          () =>
            FetchOpenAICompatibleProviderModels({
              baseUrl: draft.baseUrl,
              apiKey: draft.apiKey,
              headers: parseHeadersText(draft.headersText),
            }),
        );

        setRemoteModelsStateByName((prev) => ({
          ...prev,
        [providerName]: {
          status: 'success',
          message: result.message || t('accounts.openai_provider_models_fetch_success'),
          models: buildModelRows(result.models || []),
          lastFetchedAt: Date.now(),
          configSignature: buildProviderConfigSignature(draft),
        },
      }));
      } catch (error) {
        setRemoteModelsStateByName((prev) => ({
          ...prev,
        [providerName]: {
          status: 'error',
          message: toErrorMessage(error),
          models: prev[providerName]?.models || [],
          lastFetchedAt: Date.now(),
          configSignature: buildProviderConfigSignature(draft),
        },
      }));
      }
    },
    [t, trackRequest],
  );

  const openDetailModal = useCallback((provider: OpenAICompatibleProvider) => {
    const draft = buildOpenAICompatibleProviderDraft(provider, verifyStateByName[provider.name]);
    setDetailDraft(draft);
    setDetailError('');
    const providerConfigSignature = buildProviderConfigSignature(provider);
    const cachedState = remoteModelsStateByName[provider.name];
    if (
      !cachedState ||
      cachedState.configSignature !== providerConfigSignature ||
      shouldRefreshRemoteModels(cachedState.lastFetchedAt ?? null)
    ) {
      void fetchRemoteModelsForDraft(draft);
    }
  }, [fetchRemoteModelsForDraft, remoteModelsStateByName, verifyStateByName]);

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
          prefix: '',
          apiKey: form.apiKey,
        }),
      );
      setIsCreateModalOpen(false);
      setSelectedPresetID('');
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
        setRemoteModelsStateByName((prev) => {
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
        UpdateOpenAICompatibleProvider(
          main.UpdateOpenAICompatibleProviderInput.createFrom({
            currentName: detailDraft.currentName,
            name: detailDraft.name,
            baseUrl: detailDraft.baseUrl,
            prefix: '',
            apiKey: detailDraft.apiKey,
            apiKeys: [detailDraft.apiKey],
            headers: parseHeadersText(detailDraft.headersText),
            models: normalizeProviderModels(detailDraft.models),
          }),
        ),
      );

      setVerifyStateByName((prev) => renameProviderVerifyState(prev, detailDraft.currentName, detailDraft.name));
      setRemoteModelsStateByName((prev) => renameProviderRemoteModelsState(prev, detailDraft.currentName, detailDraft.name));
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
          configSignature: buildProviderConfigSignature(detailDraft),
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
          configSignature: buildProviderConfigSignature(detailDraft),
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
            headers: parseHeadersText(detailDraft.headersText),
          }),
      );

      setVerifyStateByName((prev) => ({
        ...prev,
        [providerName]: {
          model,
          status: result.success ? 'success' : 'error',
          message: result.message || (result.success ? t('accounts.openai_provider_test_success') : t('accounts.openai_provider_test_failed')),
          lastVerifiedAt: Date.now(),
          configSignature: buildProviderConfigSignature(detailDraft),
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
          configSignature: buildProviderConfigSignature(detailDraft),
        },
      }));
    }
  }, [detailDraft, t, trackRequest]);

  const verifyStates = useMemo(() => verifyStateByName, [verifyStateByName]);
  const remoteModelsStates = useMemo(() => remoteModelsStateByName, [remoteModelsStateByName]);

  const fetchDetailModels = useCallback(async () => {
    if (!detailDraft) {
      return;
    }
    await fetchRemoteModelsForDraft(detailDraft);
  }, [detailDraft, fetchRemoteModelsForDraft]);

  const applyFetchedModelsToDetailDraft = useCallback(() => {
    if (!detailDraft) {
      return;
    }

    const providerName = detailDraft.currentName || detailDraft.name;
    const remoteState = remoteModelsStateByName[providerName];
    if (!remoteState || remoteState.status !== 'success' || remoteState.models.length === 0) {
      return;
    }

    setDetailDraft((prev) =>
      prev
        ? {
            ...prev,
            models: remoteState.models,
            verifyModel:
              remoteState.models.some((item) => item.name === prev.verifyModel) ? prev.verifyModel : remoteState.models[0]?.name || '',
          }
        : prev,
    );
  }, [detailDraft, remoteModelsStateByName]);

  return {
    providers,
    loading,
    isCreateModalOpen,
    selectedPresetID,
    form,
    formError,
    verifyStates,
    remoteModelsStates,
    pendingDeleteName,
    detailDraft,
    detailError,
    detailSaving,
    setForm,
    setIsCreateModalOpen,
    setDetailDraft,
    openCreateModal,
    applyCreatePreset,
    openDetailModal,
    closeDetailModal,
    submitCreate,
    saveDetail,
    deleteProvider,
    verifyDetail,
    fetchDetailModels,
    applyFetchedModelsToDetailDraft,
    loadProviders,
  };
}
