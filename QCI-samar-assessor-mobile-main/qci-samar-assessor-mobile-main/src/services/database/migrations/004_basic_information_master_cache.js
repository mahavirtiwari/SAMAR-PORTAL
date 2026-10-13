import { executeSql } from '../sqlUtils';

/**
 * v4 — offline backing for Basic Information and master-data dropdowns.
 *
 * basic_information: one row per assessment holding the saved form payload
 * (the GET /basic-information shape) so the step renders and reports complete
 * offline. master_data_cache: a tiny key/value store for the global vendor
 * category / store lists so their dropdowns populate offline from the last
 * online fetch.
 */
export default {
  version: 4,
  name: 'basic_information_master_cache',
  up: async () => {
    await executeSql(
      `CREATE TABLE IF NOT EXISTS basic_information (
         assessment_id TEXT PRIMARY KEY REFERENCES assessments(id) ON DELETE CASCADE,
         server_id INTEGER,
         payload_json TEXT NOT NULL,
         local_status TEXT DEFAULT 'pending',
         updated_at TEXT DEFAULT CURRENT_TIMESTAMP
       )`
    );
    await executeSql(
      `CREATE TABLE IF NOT EXISTS master_data_cache (
         cache_key TEXT PRIMARY KEY,
         payload_json TEXT NOT NULL,
         updated_at TEXT DEFAULT CURRENT_TIMESTAMP
       )`
    );
  }
};
