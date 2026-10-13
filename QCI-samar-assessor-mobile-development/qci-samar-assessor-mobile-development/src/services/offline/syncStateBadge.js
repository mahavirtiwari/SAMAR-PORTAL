import { getStatusByOpKeys, MAX_RETRIES } from '../database/repositories/outboxRepo';

// One captured record's badge state from its outbox row: 'failed' once the row
// has stopped retrying (server-rejected or retry-exhausted), otherwise 'pending'
// (queued / mid-flight). Shared by every per-item saved/unsaved/failed badge so
// the "stuck" rule can't drift between site pictures, meetings and evidence.
const stateFromStatusRow = (row) =>
  row?.status === 'failed' && (row.terminal === 1 || row.retry_count >= MAX_RETRIES)
    ? 'failed'
    : 'pending';

// Tag each record with a per-item `syncState` ('synced' | 'pending' | 'failed')
// for the ImageSyncBadge. Already-synced records, and records with no local
// op_key (server-fetched, nothing queued), are 'synced'; the rest resolve from
// their outbox row in a single query. `opKeyFor(record)` returns the record's
// outbox op_key, or a falsy value when it has no local identity.
export const attachSyncStateByOpKey = async (records, opKeyFor) => {
  const opKeys = records.filter((r) => !r.isSynced && opKeyFor(r)).map(opKeyFor);
  const statusByOpKey = await getStatusByOpKeys(opKeys);
  return records.map((r) => {
    const opKey = r.isSynced ? null : opKeyFor(r);
    return { ...r, syncState: opKey ? stateFromStatusRow(statusByOpKey.get(opKey)) : 'synced' };
  });
};

// Single-record variant for a lone capture (e.g. a meeting photo). 'synced' when
// already on the server or when it carries no op_key; otherwise its outbox row
// decides pending vs failed.
export const deriveSyncState = async ({ isSynced, opKey }) => {
  if (isSynced || !opKey) {
    return 'synced';
  }
  const statusByOpKey = await getStatusByOpKeys([opKey]);
  return stateFromStatusRow(statusByOpKey.get(opKey));
};
