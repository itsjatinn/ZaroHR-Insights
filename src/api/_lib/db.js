const { Pool } = require("pg");

const sslEnabled =
  process.env.PGSSLMODE === "require" ||
  process.env.DATABASE_SSL === "true" ||
  process.env.VERCEL === "1";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: sslEnabled ? { rejectUnauthorized: false } : undefined,
});

const replaceParams = (sql, params = {}) => {
  const values = [];
  const text = sql.replace(/%\(([^)]+)\)s/g, (_, key) => {
    if (!(key in params)) {
      throw new Error(`Missing SQL parameter: ${key}`);
    }
    values.push(params[key]);
    return `$${values.length}`;
  });
  return { text, values };
};

const fetchAll = async (sql, params = {}) => {
  const { text, values } = replaceParams(sql, params);
  const result = await pool.query(text, values);
  return result.rows;
};

const fetchOne = async (sql, params = {}) => {
  const { text, values } = replaceParams(sql, params);
  const result = await pool.query(text, values);
  return result.rows[0] || null;
};

const withTransaction = async (fn) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

module.exports = {
  pool,
  replaceParams,
  fetchAll,
  fetchOne,
  withTransaction,
};
