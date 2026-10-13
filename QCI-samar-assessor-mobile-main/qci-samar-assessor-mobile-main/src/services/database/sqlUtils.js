import { Logger } from '../../utils/logger';
import { getConnection } from './connection';

/**
 * Execute SQL query with parameters
 */
export const executeSql = async (query, params = []) => {
  try {
    const db = await getConnection();
    const [results] = await db.executeSql(query, params);
    return results;
  } catch (error) {
    Logger.error('SQL execution failed:', error.message);
    throw error;
  }
};

/**
 * Execute multiple queries in a transaction
 */
export const executeTransaction = async (queries) => {
  try {
    const db = await getConnection();

    await db.transaction(async (tx) => {
      for (const { query, params = [] } of queries) {
        await tx.executeSql(query, params);
      }
    });

    Logger.info('Transaction completed successfully');
  } catch (error) {
    Logger.error('Transaction failed:', error.message);
    throw error;
  }
};

/**
 * Insert a record
 */
export const insert = async (tableName, data) => {
  const columns = Object.keys(data).join(', ');
  const placeholders = Object.keys(data)
    .map(() => '?')
    .join(', ');
  const values = Object.values(data);

  const query = `INSERT INTO ${tableName} (${columns}) VALUES (${placeholders})`;
  return executeSql(query, values);
};

/**
 * Update records
 */
export const update = async (tableName, data, whereClause, whereParams = []) => {
  const setClause = Object.keys(data)
    .map((key) => `${key} = ?`)
    .join(', ');
  const values = [...Object.values(data), ...whereParams];

  const query = `UPDATE ${tableName} SET ${setClause} WHERE ${whereClause}`;
  return executeSql(query, values);
};

/**
 * Delete records
 */
export const deleteRecord = async (tableName, whereClause, whereParams = []) => {
  const query = `DELETE FROM ${tableName} WHERE ${whereClause}`;
  return executeSql(query, whereParams);
};

/**
 * Select records from table
 */
export const select = async (tableName, whereClause = '', whereParams = []) => {
  const query = whereClause
    ? `SELECT * FROM ${tableName} WHERE ${whereClause}`
    : `SELECT * FROM ${tableName}`;

  const result = await executeSql(query, whereParams);

  const rows = [];
  for (let i = 0; i < result.rows.length; i++) {
    rows.push(result.rows.item(i));
  }

  return rows;
};

export default {
  executeSql,
  executeTransaction,
  insert,
  update,
  deleteRecord,
  select
};
