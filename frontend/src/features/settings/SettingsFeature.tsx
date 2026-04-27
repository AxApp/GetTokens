import { useState } from 'react';
import { ApplyUpdate, CheckUpdate } from '../../../wailsjs/go/main/App';
import { BrowserOpenURL, Quit } from '../../../wailsjs/runtime/runtime';
import SegmentedControl from '../../components/ui/SegmentedControl';
import { useDebug } from '../../context/DebugContext';
import { useI18n } from '../../context/I18nContext';
import { useTheme } from '../../context/ThemeContext';
import { mapCheckedRelease } from './settingsRelease';
import { toErrorMessage } from '../../utils/error';
import type { LocaleCode, ReleaseInfo, SegmentedOption, ThemeMode } from '../../types';

const themes: ReadonlyArray<SegmentedOption<ThemeMode>> = [
  { id: 'system', label: 'SYSTEM' },
  { id: 'light', label: 'LIGHT' },
  { id: 'dark', label: 'DARK' },
];

const languages: ReadonlyArray<SegmentedOption<LocaleCode>> = [
  { id: 'zh', label: '简体中文' },
  { id: 'en', label: 'ENGLISH' },
];

interface SettingsFeatureProps {
  version: string;
  releaseLabel: string;
  canApplyUpdate: boolean;
  usesNativeUpdaterUI: boolean;
  availableRelease: ReleaseInfo | null;
  setAvailableRelease: (release: ReleaseInfo | null) => void;
}

export default function SettingsFeature({
  version,
  releaseLabel,
  canApplyUpdate,
  usesNativeUpdaterUI,
  availableRelease,
  setAvailableRelease,
}: SettingsFeatureProps) {
  const { themeMode, setThemeMode } = useTheme();
  const { locale, setLocale, t } = useI18n();
  const { trackRequest } = useDebug();
  const [updateMessage, setUpdateMessage] = useState('');
  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false);
  const [isApplyingUpdate, setIsApplyingUpdate] = useState(false);
  const [isOpeningRelease, setIsOpeningRelease] = useState(false);

  async function handleCheckUpdate() {
    setIsCheckingUpdate(true);
    setUpdateMessage('');
    try {
      if (usesNativeUpdaterUI) {
        await trackRequest('CheckUpdate', { args: [] }, () => CheckUpdate());
        setUpdateMessage(t('settings.native_update_invoked'));
        return;
      }
      const release = await trackRequest(
        'CheckUpdate',
        { args: [] },
        () => CheckUpdate(),
        {
          mapSuccess: (result) => mapCheckedRelease(result),
        }
      );
      setAvailableRelease(release ?? null);
      setUpdateMessage(release ? t('settings.update_available') : t('settings.update_up_to_date'));
    } catch (error) {
      setUpdateMessage(`${t('settings.update_error')}: ${toErrorMessage(error)}`);
    } finally {
      setIsCheckingUpdate(false);
    }
  }

  async function handleApplyUpdate() {
    if (!availableRelease || !canApplyUpdate) {
      return;
    }

    setIsApplyingUpdate(true);
    setUpdateMessage('');
    try {
      await trackRequest('ApplyUpdate', { version: availableRelease.version }, () => ApplyUpdate());
      setUpdateMessage(t('settings.update_applied'));
      Quit();
    } catch (error) {
      setUpdateMessage(`${t('settings.update_error')}: ${toErrorMessage(error)}`);
      setIsApplyingUpdate(false);
    }
  }

  async function handleOpenReleasePage() {
    if (!availableRelease) {
      return;
    }

    setIsOpeningRelease(true);
    setUpdateMessage('');
    try {
      BrowserOpenURL(availableRelease.releaseUrl);
      setUpdateMessage(t('settings.update_redirected'));
    } catch (error) {
      setUpdateMessage(`${t('settings.update_error')}: ${toErrorMessage(error)}`);
      setIsOpeningRelease(false);
      return;
    }
    setIsOpeningRelease(false);
  }

  return (
    <div className="h-full w-full overflow-auto p-12" data-collaboration-id="PAGE_SETTINGS">
      <div className="mx-auto max-w-6xl space-y-6 pb-10">
        <header className="border-b-2 border-[var(--border-color)] pb-3">
          <h2 className="text-xl font-black uppercase italic tracking-tighter text-[var(--text-primary)]">
            {t('settings.title')}
          </h2>
          <p className="mt-0.5 text-[9px] font-bold uppercase tracking-widest text-[var(--text-muted)]">
            {t('settings.subtitle')}
          </p>
        </header>

        <div className="space-y-6">
          <section className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="bg-[var(--border-color)] px-1.5 py-0.5 font-mono text-[8px] font-black uppercase text-[var(--bg-main)]">
                01
              </span>
              <h3 className="text-xs font-black uppercase italic tracking-tighter text-[var(--text-primary)]">
                {t('settings.appearance')}
              </h3>
            </div>

            <div className="card-swiss !p-0 divide-y-2 divide-[var(--border-color)]">
              <div className="space-y-3 p-5">
                <div className="flex items-center justify-between">
                  <label className="text-[9px] font-black uppercase italic tracking-widest text-[var(--text-muted)]">
                    {t('settings.theme_mode')}
                  </label>
                  <span className="font-mono text-[8px] font-bold italic opacity-30 text-[var(--text-muted)]">
                    CONFIG_X_THEME
                  </span>
                </div>
                <SegmentedControl options={themes} value={themeMode} onChange={setThemeMode} />
              </div>

              <div className="space-y-3 p-5">
                <div className="flex items-center justify-between">
                  <label className="text-[9px] font-black uppercase italic tracking-widest text-[var(--text-muted)]">
                    {t('settings.language')}
                  </label>
                  <span className="font-mono text-[8px] font-bold italic opacity-30 text-[var(--text-muted)]">
                    CONFIG_X_LANG
                  </span>
                </div>
                <SegmentedControl options={languages} value={locale} onChange={setLocale} />
              </div>
            </div>
          </section>

          <section className="space-y-3 opacity-80">
            <div className="flex items-center gap-2">
              <span className="bg-[var(--border-color)] px-1.5 py-0.5 font-mono text-[8px] font-black uppercase text-[var(--bg-main)]">
                02
              </span>
              <h3 className="text-xs font-black uppercase italic tracking-tighter text-[var(--text-primary)]">
                {t('settings.updates')}
              </h3>
            </div>

            <div className="card-swiss bg-[var(--bg-surface)] !p-5">
              <div className="grid gap-5 md:grid-cols-[1.1fr_0.9fr]">
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <div className="text-[8px] font-bold uppercase tracking-widest text-[var(--text-muted)]">
                        {t('settings.current_version')}
                      </div>
                      <div className="text-[10px] font-black uppercase italic text-[var(--text-primary)]">
                        {version}
                      </div>
                    </div>
                    <div className="space-y-1">
                      <div className="text-[8px] font-bold uppercase tracking-widest text-[var(--text-muted)]">
                        {t('settings.release_label')}
                      </div>
                      <div className="text-[10px] font-black uppercase italic text-[var(--text-primary)]">
                        {releaseLabel || 'DEV'}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 border-t border-dashed border-[var(--border-color)] pt-4">
                    <div className="space-y-1">
                      <div className="text-[8px] font-bold uppercase tracking-widest text-[var(--text-muted)]">
                        {t('settings.latest_release')}
                      </div>
                      <div className="text-[10px] font-black uppercase italic text-[var(--text-primary)]">
                        {availableRelease?.version || '—'}
                      </div>
                    </div>
                    <div className="space-y-1">
                      <div className="text-[8px] font-bold uppercase tracking-widest text-[var(--text-muted)]">
                        {t('settings.update_asset')}
                      </div>
                      <div className="font-mono text-[9px] font-bold text-[var(--text-primary)]">
                        {availableRelease?.assetName || '—'}
                      </div>
                    </div>
                  </div>

                  <div className="border-t border-dashed border-[var(--border-color)] pt-4">
                    <div className="text-[8px] font-bold uppercase tracking-widest text-[var(--text-muted)]">
                      {t('settings.update_channel')}
                    </div>
                    <div className="mt-2 text-[10px] font-bold uppercase leading-5 tracking-widest text-[var(--text-primary)]">
                      {t(
                        usesNativeUpdaterUI
                          ? 'settings.update_channel_hint_native'
                          : canApplyUpdate
                            ? 'settings.update_channel_hint_auto'
                            : 'settings.update_channel_hint_manual'
                      )}
                    </div>
                    {updateMessage ? (
                      <div className="mt-3 border border-dashed border-[var(--border-color)] bg-[var(--bg-main)] px-3 py-2 text-[9px] font-bold uppercase leading-5 tracking-widest text-[var(--text-primary)]">
                        {updateMessage}
                      </div>
                    ) : null}
                  </div>
                </div>

                <div className="space-y-3 border-t border-dashed border-[var(--border-color)] pt-4 md:border-l md:border-t-0 md:pl-5 md:pt-0">
                  <button className="btn-swiss w-full" onClick={handleCheckUpdate} disabled={isCheckingUpdate}>
                    {isCheckingUpdate ? t('settings.checking_update') : t('settings.check_update')}
                  </button>
                  {usesNativeUpdaterUI ? null : (
                    <button
                      className="btn-swiss w-full"
                      onClick={canApplyUpdate ? handleApplyUpdate : handleOpenReleasePage}
                      disabled={!availableRelease || isApplyingUpdate || isOpeningRelease}
                    >
                      {canApplyUpdate
                        ? isApplyingUpdate
                          ? t('settings.applying_update')
                          : t('settings.apply_update')
                        : isOpeningRelease
                          ? t('settings.opening_release_page')
                          : t('settings.open_release_page')}
                    </button>
                  )}
                  <div className="text-[8px] font-bold uppercase leading-5 tracking-widest text-[var(--text-muted)]">
                    {t(
                      usesNativeUpdaterUI
                        ? 'settings.native_update_hint'
                        : canApplyUpdate
                          ? 'settings.apply_update_hint'
                          : 'settings.manual_update_hint'
                    )}
                  </div>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
