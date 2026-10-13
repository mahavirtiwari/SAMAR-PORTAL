import { executeSql } from '../sqlUtils';

/**
 * v1 — calendar_events table.
 *
 * This is the table the legacy schema.js used to create. Re-created
 * idempotently here so the migration runner can own it from now on.
 */
export default {
  version: 1,
  name: 'calendar_events',
  up: async () => {
    await executeSql(`
      CREATE TABLE IF NOT EXISTS calendar_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        calendar_id TEXT UNIQUE NOT NULL,
        site_number TEXT,
        city TEXT,
        state TEXT,
        scope_of_work TEXT,
        scheduled_start_date TEXT,
        scheduled_finish_date TEXT,
        comments TEXT,
        is_synced INTEGER DEFAULT 0,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await executeSql(
      'CREATE INDEX IF NOT EXISTS idx_calendar_events_calendar_id ON calendar_events(calendar_id)'
    );
    await executeSql(
      'CREATE INDEX IF NOT EXISTS idx_calendar_events_synced ON calendar_events(is_synced)'
    );
  }
};
