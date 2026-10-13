// Maximum time to wait for a high-accuracy GPS fix before falling back
// to "couldn't fetch location" handling. 10s balances slow indoor networks
// against UI blocking; sites that previously used 15s or 20s now share this.
export const LOCATION_TIMEOUT_MS = 10000;
// Offline there is no assisted-GPS download, so a cold GPS start routinely
// needs 30-60s for its first fix. The one-shot 10s window blocked every
// offline photo capture (BUG-08895); the warm-up watcher usually answers far
// sooner, this is the ceiling for a genuinely cold chip.
export const LOCATION_TIMEOUT_OFFLINE_MS = 45000;
// Offline fallback when no fresh fix arrives in time: reuse the last GPS fix
// this session obtained, if it is at most this old. The assessor is on site
// for the whole visit, so a fix from minutes ago is still the site.
export const LOCATION_LAST_KNOWN_MAX_AGE_MS = 10 * 60 * 1000;
// How recent a warm-up fix must be for the capture gate to reuse it and open
// the camera at once, instead of blocking on a fresh acquisition. Offline the
// warm watcher delivers fixes sparsely, so the 10s general window (maximumAge)
// often lapsed and forced a slow cold fix before every photo — the intermittent
// "camera takes seconds to open" offline. The assessor stands at one site
// through the whole capture step, so a fix up to a minute old is the same
// location and well within GPS accuracy.
export const LOCATION_CAPTURE_MAX_AGE_MS = 60000;
// Same idea for the punch-in / punch-out stamp: reuse a warm fix up to a minute
// old so the punch modal doesn't sit on "fetching…" while a fresh (offline: cold
// and slow) fix is acquired. The assessor punches while standing at the site, so
// a fix this recent is the same location; the warm-up usually keeps it far
// fresher than this ceiling anyway. Kept separate from the capture window so a
// stricter arrival/departure accuracy can be tuned here alone if ever needed.
export const LOCATION_PUNCH_MAX_AGE_MS = 60000;
