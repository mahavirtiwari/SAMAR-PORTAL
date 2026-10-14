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

/**
 * When each cached list was last written, as epoch ms keyed by cache key. Keys
 * with no cached row are absent. `updated_at` is SQLite CURRENT_TIMESTAMP, i.e.
 * UTC 'YYYY-MM-DD HH:MM:SS'. Lets the offline warm-up skip lists that are
 * still fresh instead of re-pulling every global list per assessment.
 */
export const getMasterDataCachedAt = async (cacheKeys) => {
  if (!Array.isArray(cacheKeys) || cacheKeys.length === 0) {
    return {};
  }
  const result = await executeSql(
    `SELECT cache_key, updated_at FROM master_data_cache WHERE cache_key IN (${cacheKeys
      .map(() => '?')
      .join(', ')})`,
    cacheKeys
  );
  const cachedAt = {};
  for (let i = 0; i < result.rows.length; i++) {
    const row = result.rows.item(i);
    const ms = Date.parse(`${String(row.updated_at).replace(' ', 'T')}Z`);
    if (Number.isFinite(ms)) {
      cachedAt[row.cache_key] = ms;
    }
  }
  return cachedAt;
};
