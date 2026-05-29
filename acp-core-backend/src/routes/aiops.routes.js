/**
 * aiops.routes.js
 *
 * Express routes for the AI Ops feature.
 * Register in app.js as: app.use('/api/v1/aiops', aiopsRoutes);
 */

const express = require('express');
const router = express.Router();

const aiopsController = require('../controllers/aiops.controller');
const authMiddleware = require('../middleware/auth.middleware');

// Apply auth to all AI Ops routes
router.use(authMiddleware);

// Trigger a new AI Ops scan (observe, remediate, or both)
// POST /api/v1/aiops/run
// Body: { accountId, region, mode?: 'full' | 'observe' | 'remediate-only' }
router.post('/run', aiopsController.runAiOpsScan);

// Approve or reject a pending remediation action (human-in-the-loop)
// POST /api/v1/aiops/approve
// Body: { sessionId, approved: bool, action, target }
router.post('/approve', aiopsController.approveAction);

// Get all AI Ops incidents for the current user
// GET /api/v1/aiops/incidents?status=open&limit=50
router.get('/incidents', aiopsController.getIncidents);

// Update incident status
// PATCH /api/v1/aiops/incidents/:id
// Body: { status: 'open' | 'acknowledged' | 'resolved' }
router.patch('/incidents/:id', aiopsController.updateIncident);

// GET /api/v1/aiops/runs
router.get('/runs', aiopsController.getScanRuns);

module.exports = router;
