const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432'),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false
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
        auth_type    TEXT NOT NULL DEFAULT 'role',
        role_arn     TEXT,
        external_id  TEXT,
        access_key_id TEXT,
        secret_access_key TEXT,
        is_default   BOOLEAN DEFAULT FALSE,
        created_at   TIMESTAMPTZ DEFAULT NOW(),
        updated_at   TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  // Ensure 'provider' column exists in existing tables
  await pool.query(`
    ALTER TABLE cloud_accounts ADD COLUMN IF NOT EXISTS provider TEXT NOT NULL DEFAULT 'AWS';
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

  // Infra deployments table
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
      data        JSONB,
      user_id     TEXT
    )
  `);

  await pool.query(`
    ALTER TABLE infra_deployments ADD COLUMN IF NOT EXISTS user_id TEXT;
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS aiops_events (
      id                SERIAL PRIMARY KEY,
      user_id           VARCHAR(255)  NOT NULL,

      -- Incident fields (null for pure action-only rows)
      title             TEXT,
      severity          VARCHAR(20)   CHECK (severity IN ('critical','high','medium','low')),
      root_cause        TEXT,
      status            VARCHAR(20)   DEFAULT 'open' CHECK (status IN ('open','acknowledged','resolved')),

      -- Action fields (null until remediation runs)
      action            VARCHAR(100),
      approved          BOOLEAN       DEFAULT FALSE,
      approved_by       TEXT,
      result            JSONB,
      reason            TEXT,

      -- Shared
      resource          TEXT          NOT NULL,
      created_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
      updated_at        TIMESTAMPTZ
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS aiops_scan_runs (
      id              SERIAL PRIMARY KEY,
      session_id      TEXT          NOT NULL,
      user_id         TEXT          NOT NULL,
      account_id      TEXT          NOT NULL,
      region          TEXT          NOT NULL,
      mode            TEXT          NOT NULL,
      status          TEXT          NOT NULL DEFAULT 'completed',
      infra_findings  JSONB,
      app_findings    JSONB,
      remediation     JSONB,
      scan_meta       JSONB,
      started_at      TIMESTAMPTZ   NOT NULL,
      completed_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW()
    )
  `);

  console.log('DB schema ready');
};

pool.connect()
  .then(() => console.log('DB Connected'))
  .catch(err => console.error('DB Error:', err));