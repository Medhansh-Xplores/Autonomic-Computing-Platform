/**
 * applications.controller.js
 *
 * Express controller for Application Services endpoints.
 * Bridges HTTP from the ACP Portal UI to the ADK app generation runner.
 */

const { runAppGeneration } = require('../applications/runner');
const applicationModel = require('../models/application.model');

// ── POST /api/v1/applications/generate ───────────────────────────────────────
exports.generateApplication = async (req, res) => {
    const userId = req.user?.username || 'anonymous';

    const {
        // Step 1
        appName, appType, appDescription,
        // Step 2
        frontendFramework, backendFramework,
        frontendDescription, backendDescription,
        apiEndpoints, database, authType, dataModels,
        // Step 3
        cloudProvider, deploymentType, environment, containerPort,
        // Step 4
        repoName, githubOrg, branch, isPrivate, githubPAT,
    } = req.body;

    // Basic validation
    if (!appName || !appType || !backendFramework || !repoName || !githubOrg) {
        return res.status(400).json({
            error: 'Missing required fields: appName, appType, backendFramework, repoName, githubOrg',
        });
    }

    if (!githubPAT || !githubPAT.trim()) {
        return res.status(400).json({
            error: 'githubPAT is required to create repositories and commit files',
        });
    }

    console.log(`[applications/generate] Starting for appName=${appName} user=${userId}`);

    try {
        const result = await runAppGeneration(req.body, userId);

        if (!result.repoUrl && !result.error) {
            console.error('[applications/generate] Pipeline returned no repoUrl and no error — silent failure');
            return res.status(500).json({ error: 'Code generation pipeline returned no result. Check backend logs.' });
        }

        console.log(`[applications/generate] Done. repoUrl=${result.repoUrl} files=${result.filesCommitted}`);

        res.json(result);
    } catch (err) {
        console.error('[applications/generate]', err.message);
        res.status(500).json({ error: err.message });
    }
};

// ── GET /api/v1/applications/list ─────────────────────────────────────────────
exports.listApplications = async (req, res) => {
    try {
        const userId = req.user?.username;
        const apps = await applicationModel.getApplications(userId);
        res.json(apps);
    } catch (err) {
        console.error('[applications/list]', err.message);
        res.status(500).json({ error: 'Failed to fetch applications' });
    }
};

// ── DELETE /api/v1/applications/record/:id ────────────────────────────────────
exports.deleteApplication = async (req, res) => {
    try {
        const { id } = req.params;
        await applicationModel.deleteApplication(id);
        res.json({ success: true });
    } catch (err) {
        console.error('[applications/delete]', err.message);
        res.status(500).json({ error: 'Failed to delete application' });
    }
};