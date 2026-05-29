import { useEffect, useState } from 'react';
import { CanApplyUpdate, GetReleaseLabel, GetSidecarStatus, GetVersion, UsesNativeUpdaterUI } from '../../wailsjs/go/main/App';
import { EventsOn } from '../../wailsjs/runtime/runtime';
import { useDebug } from '../context/useDebug';
import type { ReleaseInfo, SidecarStatus } from '../types';
import { getPreviewMode, hasPreviewMode, hasWailsAppBindings } from '../utils/previewMode';

const defaultSidecarStatus: SidecarStatus = {
  code: 'stopped',
  port: 0,
  message: '',
  version: '',
  gitHash: '',
  startedAtUnix: 0,
};

export function useAppBootstrap() {
  const { trackRequest } = useDebug();
  const [sidecarStatus, setSidecarStatus] = useState<SidecarStatus>(defaultSidecarStatus);
  const [version, setVersion] = useState('dev');
  const [releaseLabel, setReleaseLabel] = useState('');
  const [availableRelease, setAvailableRelease] = useState<ReleaseInfo | null>(null);
  const [canApplyUpdate, setCanApplyUpdate] = useState(true);
  const [usesNativeUpdaterUI, setUsesNativeUpdaterUI] = useState(false);

  useEffect(() => {
    let mounted = true;
    const previewMode = hasPreviewMode();
    const previewKey = getPreviewMode();
    const wailsRuntime = hasWailsAppBindings();

    async function loadInitialState() {
      if (previewMode || !wailsRuntime) {
        const previewRelease: ReleaseInfo | null =
          previewKey === 'sidebar-update'
            ? {
                version: '1.0.27',
                releaseUrl: 'https://github.com/AxApp/GetTokens/releases/tag/v1.0.27',
                assetName: 'GetTokens_macOS_AppleSilicon.dmg',
                releaseNote: 'Preview release for sidebar update prompt.',
              }
            : null;

        if (!mounted) return;
        setVersion(previewMode ? 'preview' : 'browser');
        setReleaseLabel(previewMode ? 'preview' : 'browser');
        setAvailableRelease(previewRelease);
        setCanApplyUpdate(false);
        setUsesNativeUpdaterUI(false);
        setSidecarStatus({
          code: 'running',
          port: 18317,
          message: previewMode ? 'preview runtime' : 'browser runtime',
          version: previewMode ? 'preview' : 'browser',
          gitHash: '',
          startedAtUnix: Math.floor(Date.now() / 1000),
        });
        return;
      }

      try {
        const [currentVersion, currentReleaseLabel, currentStatus, currentCanApplyUpdate, currentUsesNativeUpdaterUI] = await Promise.all([
          trackRequest('GetVersion', { args: [] }, () => GetVersion()),
          trackRequest('GetReleaseLabel', { args: [] }, () => GetReleaseLabel()),
          trackRequest('GetSidecarStatus', { args: [] }, () => GetSidecarStatus()),
          trackRequest('CanApplyUpdate', { args: [] }, () => CanApplyUpdate()),
          trackRequest('UsesNativeUpdaterUI', { args: [] }, () => UsesNativeUpdaterUI()),
        ]);
        if (!mounted) return;
        setVersion(currentVersion || 'dev');
        setReleaseLabel(currentReleaseLabel || '');
        setCanApplyUpdate(Boolean(currentCanApplyUpdate));
        setUsesNativeUpdaterUI(Boolean(currentUsesNativeUpdaterUI));
        if (currentStatus) {
          setSidecarStatus(currentStatus);
        }
      } catch (error) {
        console.error(error);
      }
    }

    loadInitialState();

    if (previewMode || !wailsRuntime) {
      return () => {
        mounted = false;
      };
    }

    const offStatus = EventsOn('sidecar:status', (status: SidecarStatus) => {
      setSidecarStatus(status);
    });
    const offRelease = EventsOn('updater:available', (release: ReleaseInfo) => {
      setAvailableRelease(release);
    });

    return () => {
      mounted = false;
      offStatus?.();
      offRelease?.();
    };
  }, [trackRequest]);

  return {
    sidecarStatus,
    version,
    releaseLabel,
    availableRelease,
    setAvailableRelease,
    canApplyUpdate,
    usesNativeUpdaterUI,
  };
}
