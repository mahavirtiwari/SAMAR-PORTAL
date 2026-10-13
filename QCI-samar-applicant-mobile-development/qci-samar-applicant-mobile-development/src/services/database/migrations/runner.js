import { Logger } from '../../../utils/logger';
import { executeSql } from '../sqlUtils';
import { migrations } from './index';

// Resolves once the schema is guaranteed present. Anything that touches a
// table (e.g. the outbox sync drain) must await this first, otherwise a fresh
// install can query a table before its migration has created it.
let markMigrationsReady;
export const migrationsReady = new Promise(resolve => {
  markMigrationsReady = resolve;
});

const readUserVersion = async () => {
  const result = await executeSql('PRAGMA user_version');
  const row = result?.rows?.item ? result.rows.item(0) : null;
  return row?.user_version ?? 0;
};

const writeUserVersion = async version => {
  // PRAGMA does not accept parameter binding; version is an integer we control.
  await executeSql(`PRAGMA user_version = ${Number(version)}`);
};

/**
 * Runs every migration whose version is strictly greater than the DB's current
 * user_version, in ascending order. On failure, throws and leaves user_version
 * at the last successful step so a retry resumes correctly.
 */
export const runMigrations = async () => {
  const current = await readUserVersion();
  Logger.info(`[migrations] current user_version=${current}`);

  const pending = migrations.filter(m => m.version > current).sort((a, b) => a.version - b.version);

  if (pending.length === 0) {
    Logger.info('[migrations] up to date');
    markMigrationsReady();
    return;
  }

  for (const m of pending) {
    Logger.info(`[migrations] applying v${m.version} — ${m.name}`);
    await m.up();
    await writeUserVersion(m.version);
    Logger.info(`[migrations] v${m.version} applied`);
  }

  markMigrationsReady();
};
