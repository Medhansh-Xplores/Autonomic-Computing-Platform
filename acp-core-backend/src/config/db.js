const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432'),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  ssl: {
    rejectUnauthorized: false   // ← add this
  }
});

exports.query = (text, params) => pool.query(text, params);

exports.initSchema = async () => {
  // App deployments (existing)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS deployments (
      id          TEXT PRIMARY KEY,
      name        TEXT,
      status      TEXT,
      url         TEXT,
      deployed_at TIMESTAMPTZ,
      updated_at  TIMESTAMPTZ,
      created_at  TIMESTAMPTZ,
      data        JSONB
    )
  `);

  // 🔥 NEW: Infra deployments table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS infra_deployments (
      id          SERIAL PRIMARY KEY,
      name        TEXT UNIQUE,
      type        TEXT,              -- vpc | ecs | rds
      status      TEXT,
      created_at  TIMESTAMPTZ DEFAULT NOW(),
      updated_at  TIMESTAMPTZ DEFAULT NOW(),
      data        JSONB
    )
  `);

  console.log('DB schema ready');
};