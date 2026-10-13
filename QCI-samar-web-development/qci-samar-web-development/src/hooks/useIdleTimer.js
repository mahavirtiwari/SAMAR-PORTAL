import { useCallback, useEffect, useRef, useState } from 'react';
import { Logger } from '../utils/logger';

const ACTIVITY_EVENTS = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'];
const THROTTLE_MS = 1000;
const POLL_MS = 1000;

// Access tokens still rotate every 15 min via the userClient refresh interceptor;
// this is the user-facing idle timeout. Warning shows 1 min before logout.
const DEFAULT_WARNING_MS = 59 * 60 * 1000; // 59 minutes
const DEFAULT_LOGOUT_MS = 60 * 60 * 1000; // 60 minutes

const useIdleTimer = ({ warningDurationMs = DEFAULT_WARNING_MS, logoutDurationMs = DEFAULT_LOGOUT_MS, onLogout, enabled = true }) => {
  const lastActivityRef = useRef(Date.now());
  const throttleRef = useRef(0);
  const intervalRef = useRef(null);
  const loggedOutRef = useRef(false);
  const warningRef = useRef(false);
  const onLogoutRef = useRef(onLogout);

  const [isWarning, setIsWarning] = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState(Math.floor((logoutDurationMs - warningDurationMs) / 1000));

  // Reset lastActivityRef whenever the timer becomes enabled (e.g. after re-login)
  useEffect(() => {
    if (enabled) {
      lastActivityRef.current = Date.now();
    }
  }, [enabled]);

  // Keep onLogout ref current to avoid stale closures
  useEffect(() => {
    onLogoutRef.current = onLogout;
  }, [onLogout]);

  const resetTimer = useCallback(() => {
    lastActivityRef.current = Date.now();
    loggedOutRef.current = false;
    warningRef.current = false;
    setIsWarning(false);
    setRemainingSeconds(Math.floor((logoutDurationMs - warningDurationMs) / 1000));
  }, [logoutDurationMs, warningDurationMs]);

  // Single polling interval that drives everything
  useEffect(() => {
    if (!enabled) {
      warningRef.current = false;
      setIsWarning(false);
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    loggedOutRef.current = false;

    const tick = () => {
      const idleMs = Date.now() - lastActivityRef.current;

      if (idleMs >= logoutDurationMs) {
        if (!loggedOutRef.current) {
          loggedOutRef.current = true;
          warningRef.current = false;
          setIsWarning(false);
          Logger.warn('Idle timeout reached, logging out');
          onLogoutRef.current?.();
        }
      } else if (idleMs >= warningDurationMs) {
        warningRef.current = true;
        setIsWarning(true);
        const remainingMs = logoutDurationMs - idleMs;
        setRemainingSeconds(Math.max(1, Math.ceil(remainingMs / 1000)));
      } else if (!warningRef.current) {
        setIsWarning(false);
        setRemainingSeconds(Math.floor((logoutDurationMs - warningDurationMs) / 1000));
      }
    };

    intervalRef.current = setInterval(tick, POLL_MS);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [enabled, warningDurationMs, logoutDurationMs]);

  // Activity listener — just resets the timestamp
  useEffect(() => {
    if (!enabled) {
      return;
    }

    const handleActivity = () => {
      // Don't reset timer during warning — user must explicitly click "Stay Logged In"
      if (warningRef.current) {
        return;
      }
      const now = Date.now();
      if (now - throttleRef.current < THROTTLE_MS) {
        return;
      }
      throttleRef.current = now;
      lastActivityRef.current = now;
    };

    ACTIVITY_EVENTS.forEach(event => document.addEventListener(event, handleActivity, { passive: true }));
    return () => {
      ACTIVITY_EVENTS.forEach(event => document.removeEventListener(event, handleActivity));
    };
  }, [enabled]);

  // Tab visibility — recheck immediately when user returns
  useEffect(() => {
    if (!enabled) {
      return;
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState !== 'visible') {
        return;
      }

      const idleMs = Date.now() - lastActivityRef.current;

      if (idleMs >= logoutDurationMs) {
        if (!loggedOutRef.current) {
          loggedOutRef.current = true;
          warningRef.current = false;
          setIsWarning(false);
          Logger.warn('Idle timeout exceeded while tab was hidden, logging out');
          onLogoutRef.current?.();
        }
      } else if (idleMs >= warningDurationMs) {
        warningRef.current = true;
        setIsWarning(true);
        const remainingMs = logoutDurationMs - idleMs;
        setRemainingSeconds(Math.max(1, Math.ceil(remainingMs / 1000)));
      } else if (!warningRef.current) {
        setIsWarning(false);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [enabled, warningDurationMs, logoutDurationMs]);

  return { remainingSeconds, isWarning, resetTimer };
};

export default useIdleTimer;
