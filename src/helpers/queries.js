const { pool } = require('../config/db');

async function queryAll(sql, params = []) {
  const result = await pool.query(sql, params);
  return result.rows;
}

async function queryOne(sql, params = []) {
  const result = await pool.query(sql, params);
  return result.rows[0] || null;
}

async function runQuery(sql, params = []) {
  const result = await pool.query(sql, params);
  return {
    rowCount: result.rowCount,
    rows: result.rows
  };
}

async function runQueryReturning(sql, params = []) {
  const result = await pool.query(sql + ' RETURNING id', params);
  return result.rows[0]?.id;
}

module.exports = {
  queryAll,
  queryOne,
  runQuery,
  runQueryReturning,
  pool
};
