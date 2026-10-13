import { useEffect } from 'react';
import { startLocationWarmup, stopLocationWarmup } from '../../../../utils/location';
import { ensurePermission } from '../../../../utils/permissions';

// Holds the GPS warm-up for the lifetime of an assessment screen. The screen
// stays mounted behind its capture children (stack navigator), so every photo
// taken during the visit finds a fix already in hand — including offline.
//
// `requestPermission` (fieldwork screens only): asks for location in-context as
// the assessment opens, so the warm-up can actually ARM before the first
// punch-in. armWatch stays inert until location is granted, and the grant used
// to happen only inside the punch modal — so the first punch was always cold
// (no warm fix yet) and slow offline. Requesting here (fieldwork start, NOT a
// login gate) gives the GPS time to lock while the assessor arrives. Soft: a
// decline never blocks the screen; the punch/capture gate still re-handles it.
// Home passes nothing — it must not prompt out of context.
const useLocationWarmup = ({ requestPermission = false } = {}) => {
  useEffect(() => {
    let cancelled = false;
    if (requestPermission) {
      (async () => {
        await ensurePermission('location');
        if (!cancelled) {
          startLocationWarmup();
        }
      })();
    } else {
      startLocationWarmup();
    }
    return () => {
      cancelled = true;
      stopLocationWarmup();
    };
  }, [requestPermission]);
};

export default useLocationWarmup;
