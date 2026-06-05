import { useCallback, useEffect, useState } from "react";
import { ListOpenAICompatibleProviders } from "../../../../wailsjs/go/main/App";
import type { TrackRequest } from "../model/types";
import type { OpenAICompatibleProvider } from "../model/openAICompatible";
import { getAccountsPreviewOpenAICompatibleProviders } from "../previewData";
import { hasWailsAppBindings } from "../../../utils/previewMode";

interface UseOpenAICompatibleStateArgs {
  ready: boolean;
  trackRequest: TrackRequest;
}

export default function useOpenAICompatibleState({
  ready,
  trackRequest,
}: UseOpenAICompatibleStateArgs) {
  const browserMode = !hasWailsAppBindings();
  const [providers, setProviders] = useState<OpenAICompatibleProvider[]>([]);
  const [loading, setLoading] = useState(false);

  const loadProviders = useCallback(async () => {
    if (!ready) {
      return;
    }
    if (browserMode) {
      setProviders(getAccountsPreviewOpenAICompatibleProviders());
      return;
    }
    setLoading(true);
    try {
      const result = await trackRequest(
        "ListOpenAICompatibleProviders",
        { args: [] },
        () => ListOpenAICompatibleProviders(),
      );
      setProviders(result || []);
    } finally {
      setLoading(false);
    }
  }, [browserMode, ready, trackRequest]);

  useEffect(() => {
    if (ready) {
      void loadProviders();
    }
  }, [loadProviders, ready]);

  return {
    providers,
    loading,
    loadProviders,
  };
}
