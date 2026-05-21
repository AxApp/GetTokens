import { useCallback, useEffect, useState } from 'react';
import { GetCodexLiveSessionsSnapshot } from '../../../wailsjs/go/main/App';
import type { SidecarStatus } from '../../types';
import { hasWailsAppBindings } from '../../utils/previewMode';
import CodexLiveSessionsWorkbench from './components/CodexLiveSessionsWorkbench';
import { mapBackendCodexLiveSessionsSnapshot } from './model/adapters';
import {
  codexLiveSessionsPreviewSnapshot,
  codexLiveSessionsSidecarNotReadySnapshot,
} from './model/mockData';
import type { CodexLiveSessionSnapshot } from './model/types';

interface CodexLiveSessionsFeatureProps {
  sidecarStatus: SidecarStatus;
}

export default function CodexLiveSessionsFeature({ sidecarStatus }: CodexLiveSessionsFeatureProps) {
  const sidecarReady = sidecarStatus?.code === 'ready';
  const browserMode = !hasWailsAppBindings();
  const [snapshot, setSnapshot] = useState<CodexLiveSessionSnapshot>(() =>
    sidecarReady ? codexLiveSessionsPreviewSnapshot : codexLiveSessionsSidecarNotReadySnapshot,
  );

  const loadSnapshot = useCallback(async () => {
    if (browserMode) {
      setSnapshot(sidecarReady ? codexLiveSessionsPreviewSnapshot : codexLiveSessionsSidecarNotReadySnapshot);
      return;
    }
    if (!sidecarReady) {
      setSnapshot((current) => ({
        ...codexLiveSessionsSidecarNotReadySnapshot,
        sessions: current.sessions.length > 0 ? current.sessions : codexLiveSessionsSidecarNotReadySnapshot.sessions,
      }));
      return;
    }
    const nextSnapshot = await GetCodexLiveSessionsSnapshot();
    setSnapshot(mapBackendCodexLiveSessionsSnapshot(nextSnapshot));
  }, [browserMode, sidecarReady]);

  useEffect(() => {
    let cancelled = false;
    const refresh = () => {
      loadSnapshot().catch((error) => {
        if (cancelled) {
          return;
        }
        console.error(error);
        setSnapshot((current) => ({
          ...current,
          sidecarReady: false,
          source: current.sessions.length > 0 ? 'cache' : 'preview',
        }));
      });
    };

    refresh();
    if (browserMode || !sidecarReady) {
      return () => {
        cancelled = true;
      };
    }

    const timer = window.setInterval(refresh, 2000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [browserMode, loadSnapshot, sidecarReady]);

  return <CodexLiveSessionsWorkbench snapshot={snapshot} onRefresh={loadSnapshot} />;
}
