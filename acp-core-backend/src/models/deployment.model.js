const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const USE_DB = process.env.USE_DB === 'true';
const deploymentsPath = path.join(__dirname, '../../deployments');

// ─── CREATE ───────────────────────────────────────────────────────────────────

exports.createDeployment = async (data) => {
    const id = uuidv4();
    data.id = id;
    data.updatedAt = new Date().toISOString();

    if (USE_DB) {
        const db = require('../config/db');
        await db.query(
            `INSERT INTO deployments (id, name, status, url, created_at, updated_at, data)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [
                id,
                data.name || null,
                data.status || null,
                data.url || null,
                data.createdAt || new Date().toISOString(),
                data.updatedAt,
                JSON.stringify(data)
            ]
        );
        return { id };
    }

    // ── local filesystem (unchanged) ──
    const safeName = (data.name || 'deployment')
        .toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9\-]/g, '');

    const folder = path.join(deploymentsPath, `${safeName}-${id}`);
    fs.mkdirSync(folder, { recursive: true });
    fs.writeFileSync(path.join(folder, 'metadata.json'), JSON.stringify(data, null, 2));

    return { id };
};

// ─── GET ALL ──────────────────────────────────────────────────────────────────

// AFTER
exports.getDeployments = async (userId) => {
    if (USE_DB) {
        const db = require('../config/db');
        // If userId provided, filter to only that user's deployments
        const result = userId
            ? await db.query(
                `SELECT data FROM deployments WHERE data->>'userId' = $1 ORDER BY created_at DESC`,
                [userId]
            )
            : await db.query('SELECT data FROM deployments ORDER BY created_at DESC');
        return result.rows.map(row => row.data);
    }

    // ── local filesystem ──
    if (!fs.existsSync(deploymentsPath)) return [];

    return fs.readdirSync(deploymentsPath).map(folder => {
        const metadataPath = path.join(deploymentsPath, folder, 'metadata.json');
        if (fs.existsSync(metadataPath)) {
            return JSON.parse(fs.readFileSync(metadataPath));
        }
    }).filter(Boolean).filter(d => !userId || d.userId === userId);
};

// ─── UPDATE STATUS ────────────────────────────────────────────────────────────

exports.updateStatus = async (id, payload) => {
    const { status, url } = payload || {};

    if (USE_DB) {
        const db = require('../config/db');

        const existing = await db.query('SELECT data FROM deployments WHERE id = $1', [id]);
        if (!existing.rows.length) return;

        const data = existing.rows[0].data;
        if (status) data.status = status;
        if (url != null) data.url = url;

        const normalizedStatus = (status || '').toLowerCase();
        if (['deployed', 'completed', 'active'].includes(normalizedStatus)) {
            data.deployedAt = new Date().toISOString();
        }
        data.updatedAt = new Date().toISOString();

        await db.query(
            `UPDATE deployments
       SET status = $2, url = $3, updated_at = $4, deployed_at = $5, data = $6
       WHERE id = $1`,
            [id, data.status, data.url, data.updatedAt, data.deployedAt || null, JSON.stringify(data)]
        );
        return;
    }

    // ── local filesystem (unchanged) ──
    const folders = fs.readdirSync(deploymentsPath);
    folders.forEach(folder => {
        const metadataPath = path.join(deploymentsPath, folder, 'metadata.json');
        if (fs.existsSync(metadataPath)) {
            const data = JSON.parse(fs.readFileSync(metadataPath));
            if (data.id === id) {
                if (status) data.status = status;
                if (url != null) data.url = url;
                const normalizedStatus = (status || '').toLowerCase();
                if (['deployed', 'completed', 'active'].includes(normalizedStatus)) {
                    data.deployedAt = new Date().toISOString();
                }
                data.updatedAt = new Date().toISOString();
                fs.writeFileSync(metadataPath, JSON.stringify(data, null, 2));
            }
        }
    });
};

// ─── DELETE ───────────────────────────────────────────────────────────────────

exports.deleteDeployment = async (id) => {
    if (USE_DB) {
        const db = require('../config/db');
        await db.query('DELETE FROM deployments WHERE id = $1', [id]);
        return;
    }

    // ── local filesystem ──
    if (!fs.existsSync(deploymentsPath)) return;

    const folders = fs.readdirSync(deploymentsPath);
    for (const folder of folders) {
        const metadataPath = path.join(deploymentsPath, folder, 'metadata.json');
        if (fs.existsSync(metadataPath)) {
            const data = JSON.parse(fs.readFileSync(metadataPath));
            if (data.id === id) {
                fs.rmSync(path.join(deploymentsPath, folder), { recursive: true, force: true });
                return;
            }
        }
    }
};