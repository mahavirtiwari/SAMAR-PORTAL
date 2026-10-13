import { getUnsyncedOpByKey } from '../database/repositories/outboxRepo';
import { findSiteTourPictureByServerOrLocalId } from '../database/repositories/sitePicturesRepo';
import { executeSql } from '../database/sqlUtils';

/**
 * Resolve the outbox row id that was just enqueued by op_key so the
 * caller can hand that row to the drain and read its status back.
 */
export const findOutboxIdByKey = async (opKey) => {
  const result = await executeSql('SELECT id FROM outbox WHERE op_key = ?', [opKey]);
  if (result.rows.length === 0) {
    return null;
  }
  return result.rows.item(0).id;
};

const isServerIntegerId = (value) => /^\d+$/.test(String(value));

/**
 * Resolve an evidence's sourceSiteTourPictureId to the SERVER id the API
 * validates against. The picker stamps `row.server_id || row.id`, so a picture
 * captured offline contributes its LOCAL text id — which the server's
 * integer+exists validation rejects with a 422 the sync engine would retire as
 * terminal, permanently losing the evidence.
 *
 * Returns:
 *   { serverId }           — send this value (null = send no link at all)
 *   { unresolved: true }   — the source picture exists locally but hasn't
 *                            synced yet; the caller must NOT upload now
 *                            (defer until the picture's own sync assigns
 *                            a server id).
 */
export const resolveSourceSiteTourPictureId = async (value) => {
  if (value == null) {
    return { serverId: null };
  }
  if (isServerIntegerId(value)) {
    return { serverId: value };
  }
  const row = await findSiteTourPictureByServerOrLocalId(value);
  if (row?.server_id) {
    return { serverId: row.server_id };
  }
  if (row) {
    // The picture exists locally but hasn't synced. Defer ONLY while its own
    // upload can still happen: if that upload was retired terminally (server
    // rejection, lost file) or its outbox row is gone (discarded / never
    // queued), the link can never resolve — deferring then would re-defer the
    // evidence on every drain forever, invisibly, and permanently fence the
    // assessment's punch-out. Mirrors the meeting fence's terminal-does-not-
    // block rule: upload the evidence without the link instead.
    const pictureOp = await getUnsyncedOpByKey(`siteTourPicture:${row.id}`);
    if (!pictureOp || pictureOp.terminal === 1) {
      return { serverId: null };
    }
    return { unresolved: true };
  }
  // Source picture no longer exists locally (deleted before its sync) — the
  // link can never resolve. Upload the evidence itself without it.
  return { serverId: null };
};
