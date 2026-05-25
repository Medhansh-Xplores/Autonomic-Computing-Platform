/**
 * aiops.controller.js
 *
 * Express controller for AI Ops endpoints.
 * Bridges HTTP requests from the ACP Portal UI to the ADK runner.
 */

const { runAiOps, resumeAiOps } = require('../aiops/runner');
const db = require('../config/db');

// ── POST /api/v1/aiops/run ────────────────────────────────────────────────────
// Starts a new AI Ops scan + remediation cycle.
// Body: { accountId, region, mode? }
exports.runAiOpsScan = async (req, res) => {
    const userId = req.user?.username;
    const { accountId, region, mode = 'full' } = req.body;

    if (!accountId || !region) {
        return res.status(400).json({ error: 'Missing required fields: accountId, region' });
    }

    // Validate mode
    if (!['full', 'observe', 'remediate-only'].includes(mode)) {
        return res.status(400).json({ error: 'mode must be: full | observe | remediate-only' });
    }

    try {
        const result = await runAiOps({ userId, accountId, region, mode });
        res.json(result);
    } catch (err) {
        console.error('[aiops/run]', err.message);
        res.status(500).json({ error: err.message });
    }
};

// ── POST /api/v1/aiops/approve ────────────────────────────────────────────────
// Resume a session after a human approves or rejects a pending action.
// Body: { sessionId, approved, action, target }
exports.approveAction = async (req, res) => {
    const userId = req.user?.username;
    const { sessionId, approved, action, target } = req.body;

    if (!sessionId || approved === undefined || !action || !target) {
        return res.status(400).json({
            error: 'Missing required fields: sessionId, approved (bool), action, target',
        });
    }

    try {
        const result = await resumeAiOps({ sessionId, userId, approved, action, target });
        res.json(result);
    } catch (err) {
        console.error('[aiops/approve]', err.message);
        res.status(500).json({ error: err.message });
    }
};

// ── GET /api/v1/aiops/incidents ───────────────────────────────────────────────
// Fetch all AI Ops incidents for the current user.
exports.getIncidents = async (req, res) => {
    const userId = req.user?.username;
    const { status, limit = 50 } = req.query;

    try {
        const query = status
            ? `SELECT * FROM aiops_incidents WHERE user_id = $1 AND status = $2 ORDER BY created_at DESC LIMIT $3`
            : `SELECT * FROM aiops_incidents WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2`;

        const params = status ? [userId, status, limit] : [userId, limit];
        const result = await db.query(query, params);
        res.json(result.rows);
    } catch (err) {
        console.error('[aiops/incidents]', err.message);
        res.status(500).json({ error: err.message });
    }
};

// ── GET /api/v1/aiops/audit-log ───────────────────────────────────────────────
// Fetch the audit trail of all remediation actions taken by agents.
exports.getAuditLog = async (req, res) => {
    const userId = req.user?.username;
    const { limit = 100 } = req.query;

    try {
        const result = await db.query(
            `SELECT * FROM aiops_audit_log WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2`,
            [userId, limit]
        );
        res.json(result.rows);
    } catch (err) {
        console.error('[aiops/audit-log]', err.message);
        res.status(500).json({ error: err.message });
    }
};

// ── PATCH /api/v1/aiops/incidents/:id ────────────────────────────────────────
// Update incident status (open → resolved / acknowledged).
exports.updateIncident = async (req, res) => {
    const userId = req.user?.username;
    const { id } = req.params;
    const { status } = req.body;

    if (!['open', 'acknowledged', 'resolved'].includes(status)) {
        return res.status(400).json({ error: 'status must be: open | acknowledged | resolved' });
    }

    try {
        const result = await db.query(
            `UPDATE aiops_incidents SET status = $1, updated_at = NOW()
             WHERE id = $2 AND user_id = $3 RETURNING *`,
            [status, id, userId]
        );
        if (!result.rows.length) return res.status(404).json({ error: 'Incident not found' });
        res.json(result.rows[0]);
    } catch (err) {
        console.error('[aiops/incident-update]', err.message);
        res.status(500).json({ error: err.message });
    }
};

exports.getScanRuns = async (req, res) => {
    const userId = req.user?.username;
    const { limit = 20 } = req.query;
    try {
        const result = await db.query(
            `SELECT id, session_id, account_id, region, mode, status, scan_meta, started_at, completed_at
             FROM aiops_scan_runs WHERE user_id = $1 ORDER BY started_at DESC LIMIT $2`,
            [userId, limit]
        );
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};
