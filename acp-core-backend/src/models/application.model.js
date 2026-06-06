const { v4: uuidv4 } = require('uuid');
const db = require('../config/db');

// ─── CREATE ───────────────────────────────────────────────────────────────────

exports.createApplication = async (data) => {
    const id = uuidv4();
    const now = new Date().toISOString();

    await db.query(
        `INSERT INTO applications
            (id, app_name, app_type, tech_stack, cloud_provider, deployment_type,
             environment, repo_name, github_org, repo_url, files_committed,
             status, created_at, updated_at, user_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
        [
            id,
            data.appName || null,
            data.appType || null,
            data.techStack || null,
            data.cloudProvider || null,
            data.deploymentType || null,
            data.environment || null,
            data.repoName || null,
            data.githubOrg || null,
            data.repoUrl || null,
            data.filesCommitted || 0,
            data.status || 'Completed',
            now,
            now,
            data.userId || null,
        ]
    );

    return { id };
};

// ─── GET ALL (filtered by user) ───────────────────────────────────────────────

exports.getApplications = async (userId) => {
    const result = userId
        ? await db.query(
            `SELECT * FROM applications WHERE user_id = $1 ORDER BY created_at DESC`,
            [userId]
        )
        : await db.query(`SELECT * FROM applications ORDER BY created_at DESC`);

    return result.rows;
};

// ─── DELETE ───────────────────────────────────────────────────────────────────

exports.deleteApplication = async (id) => {
    await db.query('DELETE FROM applications WHERE id = $1', [id]);
};