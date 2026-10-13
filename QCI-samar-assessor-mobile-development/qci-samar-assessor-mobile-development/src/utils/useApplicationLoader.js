import { useEffect } from 'react';
import ApplicationLoader from '../components/shared/Loader';

/**
 * Holds the full-screen loader for as long as `isBusy` is true, under a key
 * that belongs to this caller alone.
 *
 * Use this instead of calling ApplicationLoader.show/hide from an effect. It
 * closes the two holes the imperative calls kept re-opening: another screen's
 * hide can no longer lift YOUR overlay, and a screen unmounted mid-request
 * releases on the way out instead of leaving the overlay up for good.
 *
 * @param {string} owner  Stable key for this caller, e.g. 'openingMeeting'.
 *                        Two callers must not share a key unless they really
 *                        are one unit of work.
 * @param {boolean} isBusy Whether this caller currently wants the overlay.
 */
export const useApplicationLoader = (owner, isBusy) => {
  useEffect(() => {
    if (isBusy) {
      ApplicationLoader.show(owner);
    } else {
      ApplicationLoader.hide(owner);
    }
    return () => {
      ApplicationLoader.hide(owner);
    };
  }, [owner, isBusy]);
};

export default useApplicationLoader;
