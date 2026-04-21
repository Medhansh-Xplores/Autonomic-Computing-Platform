const { Pool } = require('pg');

const pool = new Pool({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || '5432'),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
});

exports.query = (text, params) => pool.query(text, params);

exports.initSchema = async () => {
    await pool.query(`
    CREATE TABLE IF NOT EXISTS deployments (
      id           TEXT PRIMARY KEY,
      name         TEXT,
      status       TEXT,
      url          TEXT,
      deployed_at  TIMESTAMPTZ,
      updated_at   TIMESTAMPTZ,
      created_at   TIMESTAMPTZ,
      data         JSONB
    )
  `);
    console.log('DB schema ready');
};