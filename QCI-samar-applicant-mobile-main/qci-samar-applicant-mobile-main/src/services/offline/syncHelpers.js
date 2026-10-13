import { executeSql } from '../database/sqlUtils';

/**
 * Resolve the outbox row id that was just enqueued by op_key so the caller can
 * mark it synced on inline success.
 */
export const findOutboxIdByKey = async opKey => {
  const result = await executeSql('SELECT id FROM outbox WHERE op_key = ?', [opKey]);
  if (result.rows.length === 0) {
    return null;
  }
  return result.rows.item(0).id;
};
