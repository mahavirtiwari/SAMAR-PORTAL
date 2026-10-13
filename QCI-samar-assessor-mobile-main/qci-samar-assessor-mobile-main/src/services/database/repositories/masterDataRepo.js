import { executeSql } from '../sqlUtils';

/**
 * Tiny key/value cache for global master-data lists (vendor categories,
 * stores, …). Written on every successful online fetch and read back when the
 * fetch fails offline, so the Basic Information dropdowns stay populated.
 */
export const cacheMasterData = async (cacheKey, payload) => {
  await executeSql(
    `INSERT INTO master_data_cache (cache_key, payload_json, updated_at)
     VALUES (?, ?, CURRENT_TIMESTAMP)
     ON CONFLICT(cache_key) DO UPDATE SET
       payload_json = excluded.payload_json,
       updated_at = CURRENT_TIMESTAMP`,
    [cacheKey, JSON.stringify(payload ?? null)]
  );
};

export const getCachedMasterData = async (cacheKey) => {
  const result = await executeSql(
    'SELECT payload_json FROM master_data_cache WHERE cache_key = ? LIMIT 1',
    [cacheKey]
  );
  if (result.rows.length === 0) {
    return null;
  }
  const raw = result.rows.item(0).payload_json;
  return raw ? JSON.parse(raw) : null;
};
