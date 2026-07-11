import React, { useState, useEffect, useCallback } from 'react';
import { Check, AlertCircle, RefreshCw, Power } from 'lucide-react';

interface UpdateInfo {
  latestVersion: string;
  releaseUrl: string;
}

const UpdateChecker: React.FC = () => {
  const [appVersion, setAppVersion] = useState<string>('');
  const [update, setUpdate] = useState<UpdateInfo | null>(null);
  const [checking, setChecking] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState<number | null>(null);
  const [showQuit, setShowQuit] = useState(false);

  const check = useCallback(async () => {
    setChecking(true);
    try {
      const res = await window.api?.checkForUpdates?.();
      if (res?.currentVersion) setAppVersion(res.currentVersion);
      if (res?.hasUpdate && res.latestVersion && res.releaseUrl) {
        setUpdate({ latestVersion: res.latestVersion, releaseUrl: res.releaseUrl });
      } else {
        setUpdate(null);
      }
    } catch {
      /* ignore — non-fatal */
    } finally {
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    window.api?.getAppVersion?.().then(v => { if (v) setAppVersion(v); });
    check();
  }, [check]);

  const handleClick = async () => {
    if (downloadProgress !== null && downloadProgress >= 100) {
      setShowQuit(true);
      return;
    }
    if (checking || downloadProgress !== null) return;

    if (update) {
      setDownloadProgress(0);
      const cleanup = window.api?.onUpdateDownloadProgress?.((data) => {
        setDownloadProgress(data.progress);
      });
      try {
        const result = await window.api?.downloadAndInstallUpdate?.({ releaseUrl: update.releaseUrl });
        if (result?.success) {
          setDownloadProgress(100);
          setShowQuit(true);
        } else {
          window.api?.openExternal?.(update.releaseUrl);
          setDownloadProgress(null);
        }
      } catch {
        window.api?.openExternal?.(update.releaseUrl);
        setDownloadProgress(null);
      } finally {
        cleanup?.();
      }
      return;
    }

    await check();
  };

  const btnClass = 'w-9 h-9 flex items-center justify-center transition-colors';
  const colorClass = update
    ? 'text-amber-500 hover:bg-gray-700'
    : 'text-gray-400 hover:bg-gray-700 hover:text-gray-200';

  const tooltip =
    downloadProgress !== null && downloadProgress >= 100
      ? 'Update ready — click to quit & install'
      : downloadProgress !== null
        ? `Downloading… ${downloadProgress}%`
        : update
          ? `v${appVersion || '?'} → v${update.latestVersion} available`
          : checking
            ? 'Checking for updates…'
            : `v${appVersion || '?'} — up to date`;

  return (
    <div className="relative group/update" style={{ WebkitAppRegion: 'no-drag' as any }}>
      <button onClick={handleClick} title={tooltip} className={`${btnClass} ${colorClass}`}>
        {downloadProgress !== null ? (
          downloadProgress >= 100 ? (
            <Check size={15} className="text-green-400" />
          ) : (
            <span className="text-[10px] font-mono text-amber-400">{downloadProgress}%</span>
          )
        ) : update ? (
          <AlertCircle size={15} />
        ) : checking ? (
          <RefreshCw size={15} className="animate-spin" />
        ) : (
          <Check size={15} className="text-gray-500" />
        )}
      </button>

      {showQuit && (
        <>
          <div className="fixed inset-0 z-40" onMouseDown={() => setShowQuit(false)} />
          <div className="absolute top-full right-0 mt-1 bg-gray-900 border border-gray-700 rounded-lg shadow-xl z-50 p-3 min-w-[230px]">
            <p className="text-[11px] text-gray-300 mb-2">Update downloaded. Close to install?</p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => window.api?.closeWindow?.()}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-green-600 hover:bg-green-500 text-white rounded transition-colors"
              >
                <Power size={12} /> Quit & Install
              </button>
              <button
                onClick={() => setShowQuit(false)}
                className="px-3 py-1.5 text-xs text-gray-400 hover:text-gray-200 hover:bg-white/10 rounded transition-colors"
              >
                Later
              </button>
            </div>
          </div>
        </>
      )}

      {!showQuit && (
        <div className="absolute top-full right-0 mt-1 px-2 py-1 bg-gray-900 border border-gray-700 rounded text-[10px] text-gray-300 whitespace-nowrap opacity-0 group-hover/update:opacity-100 pointer-events-none transition-opacity duration-150 z-50">
          {tooltip}
        </div>
      )}
    </div>
  );
};

export default UpdateChecker;