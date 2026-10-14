import { useEffect, useRef } from 'react';

/**
 * Re-runs `refresh` while the page is open so data synced from the mobile apps
 * (photos, captions, meeting comments) shows up without a reload: on window
 * focus, when the tab becomes visible again, and every `intervalMs` while the
 * tab is visible. Pair it with a silent fetch so the screen does not flash a
 * loader on every tick.
 */
const useLiveRefresh = (refresh, { intervalMs = 30000, enabled = true } = {}) => {
  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;

  useEffect(() => {
    if (!enabled) {
      return undefined;
    }
    const run = () => {
      if (document.visibilityState === 'visible') {
        refreshRef.current?.();
      }
    };
    const timer = window.setInterval(run, intervalMs);
    window.addEventListener('focus', run);
    document.addEventListener('visibilitychange', run);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', run);
      document.removeEventListener('visibilitychange', run);
    };
  }, [enabled, intervalMs]);
};

export default useLiveRefresh;
