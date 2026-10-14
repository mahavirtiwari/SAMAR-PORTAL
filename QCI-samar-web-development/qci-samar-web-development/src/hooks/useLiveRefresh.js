import { useEffect, useRef } from 'react';

// Focus and visibilitychange both fire on a single alt-tab or tab switch; anything
// closer than this to the previous run is treated as the same return to the page.
const MIN_GAP_MS = 10000;
// Each tick lands within ±20% of the interval so many open tabs do not poll in lockstep.
const JITTER = 0.2;
// After a failed refresh the delay doubles up to this ceiling, and resets on success.
const MAX_BACKOFF_MS = 120000;

// A dispatched thunk resolves even when it is rejected, so failure is read off the action.
const isFailure = result => result?.meta?.requestStatus === 'rejected';

/**
 * Re-runs `refresh` while the page is open so data synced from the mobile apps
 * (photos, captions, meeting comments) shows up without a reload: on window
 * focus, when the tab becomes visible again, and every `intervalMs` while the
 * tab is visible. Pair it with a silent fetch so the screen does not flash a
 * loader on every tick.
 *
 * `refresh` may return a promise (e.g. the result of `dispatch(thunk())`): a tick
 * is skipped while the previous refresh is still in flight, and a rejected or
 * thrown refresh backs the interval off until one succeeds.
 */
const useLiveRefresh = (refresh, { intervalMs = 30000, enabled = true } = {}) => {
  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;

  useEffect(() => {
    if (!enabled) {
      return undefined;
    }

    let timer = null;
    let inFlight = false;
    let lastRunAt = Date.now();
    let delay = intervalMs;
    let cancelled = false;

    const schedule = () => {
      window.clearTimeout(timer);
      const jittered = delay * (1 - JITTER + Math.random() * 2 * JITTER);
      timer = window.setTimeout(tick, jittered);
    };

    const run = async () => {
      if (inFlight || document.visibilityState !== 'visible') {
        return;
      }
      inFlight = true;
      lastRunAt = Date.now();
      let failed = false;
      try {
        failed = isFailure(await refreshRef.current?.());
      } catch {
        failed = true;
      } finally {
        inFlight = false;
      }
      delay = failed ? Math.min(delay * 2, MAX_BACKOFF_MS) : intervalMs;
    };

    async function tick() {
      await run();
      if (!cancelled) {
        schedule();
      }
    }

    // One handler for both events, so returning to the page refreshes once.
    const handleReturn = () => {
      if (document.visibilityState === 'visible' && Date.now() - lastRunAt >= MIN_GAP_MS) {
        run();
      }
    };

    schedule();
    window.addEventListener('focus', handleReturn);
    document.addEventListener('visibilitychange', handleReturn);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      window.removeEventListener('focus', handleReturn);
      document.removeEventListener('visibilitychange', handleReturn);
    };
  }, [enabled, intervalMs]);
};

export default useLiveRefresh;
