import { checkInternetConnection } from '../../utils/checkInternetConnection';
import { Logger } from '../../utils/logger';
import { getOutboxStatusById } from '../database/repositories/outboxRepo';
import { drainOutbox } from './syncEngine';

/**
 * The one upload path. A capture helper writes its local rows, enqueues the
 * op and calls this: online, the drain runs (or is joined when one is already
 * in flight) and the row's status is read back; offline, nothing is sent and
 * the row waits for reconnect. Returns true only when the row is on the server
 * now, so callers can trust `synced`.
 *
 * Two upload paths used to race on the same row (the helper's own request and
 * the drain's), which doubled photo traffic into the rate limit and let the
 * losing request overwrite the row's synced state.
 *
 * A joined drain took its row snapshot before this row existed, so only that
 * case earns one follow-up drain. Every other non-synced outcome (the drain
 * paused on a rate limit, went offline, lost the session, deferred the row
 * behind a fence, or failed it) is final for this call: a second drain could
 * not change it and would re-send every row that just network-failed.
 */
export const flushOutbox = async (outboxRowId, label = 'capture') => {
  if (!(await checkInternetConnection())) {
    Logger.info(`[offline] ${label} queued (offline), will sync on reconnect`);
    return false;
  }
  const statusNow = async () => (outboxRowId != null ? getOutboxStatusById(outboxRowId) : null);
  const onFailure = (error) =>
    Logger.warn(`[offline] ${label} capture-time drain failed:`, error?.message);
  let result = await drainOutbox({ force: true }).catch(onFailure);
  let status = await statusNow();
  if (status === 'pending' && result?.joined && !result.aborted && !result.offline) {
    result = await drainOutbox({ force: true }).catch(onFailure);
    status = await statusNow();
  }
  if (status !== 'synced') {
    Logger.info(`[offline] ${label} queued (${status ?? 'no row'}), the drain retries it`);
  }
  return status === 'synced';
};
