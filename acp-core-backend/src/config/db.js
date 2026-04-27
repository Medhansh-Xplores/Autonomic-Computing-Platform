const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432'),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  // db.js — fixed
  ssl: process.env.USE_DB === 'true' ? { rejectUnauthorized: false } : false
});

exports.query = (text, params) => pool.query(text, params);

exports.initSchema = async () => {

  await pool.query(`
    CREATE TABLE IF NOT EXISTS cloud_accounts (
        id           SERIAL PRIMARY KEY,
        user_id      TEXT NOT NULL,
        provider     TEXT NOT NULL DEFAULT 'AWS',
        account_id   TEXT NOT NULL,
        account_name TEXT NOT NULL,
        region       TEXT NOT NULL,
        role_arn     TEXT NOT NULL,
        external_id  TEXT NOT NULL,
        is_default   BOOLEAN DEFAULT FALSE,
        created_at   TIMESTAMPTZ DEFAULT NOW(),
        updated_at   TIMESTAMPTZ DEFAULT NOW()
    )
`);
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
    id          TEXT PRIMARY KEY,
    name        TEXT UNIQUE,
    type        TEXT,
    status      TEXT,
    region      TEXT,
    account     TEXT,
    cloud       TEXT,
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    updated_at  TIMESTAMPTZ DEFAULT NOW(),
    data        JSONB
  )
`);

  console.log('DB schema ready');
};

pool.connect()
  .then(() => console.log('DB Connected'))
  .catch(err => console.error('DB Error:', err));