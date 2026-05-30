const deploymentService = require('../models/deployment.model');

exports.createDeployment = async (req, res) => {
    try {
        const body = { ...req.body, userId: req.user?.username };
        const result = await deploymentService.createDeployment(body);
        res.json(result);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to create deployment' });
    }
};

// AFTER
exports.getDeployments = async (req, res) => {
    try {
        const userId = req.user?.username;
        const deployments = await deploymentService.getDeployments(userId);
        res.json(deployments);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to fetch deployments' });
    }
};

exports.updateStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status, url } = req.body;
        await deploymentService.updateStatus(id, { status, url });
        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to update status' });
    }
};

// deployments.controller.js

const path = require('path');
const fs = require('fs');

exports.deleteDeployment = async (req, res) => {
    const { id } = req.params;

    try {
        const db = require('../config/db');

        // 1. Fetch the deployment record to get ecsCluster, appName, region
        const result = await db.query('SELECT data FROM deployments WHERE id = $1', [id]);
        if (!result.rows.length) {
            return res.status(404).json({ error: 'Deployment not found' });
        }

        const data = result.rows[0].data;
        const { ecsCluster, region, name: appName } = data;

        // 2. Mark as Deleting immediately
        await db.query(
            `UPDATE deployments SET status = 'Deleting', updated_at = NOW(),
             data = data || '{"status":"Deleting"}' WHERE id = $1`, [id]
        );
        const requestUserId = req.user?.username || null;
        res.json({ message: 'Delete started', id });

        // 3. Background: resolve AWS credentials from ECS cluster metadata
        try {
            const terraformService = require('../services/terraform.service');
            const infraController = require('./infra.controller');

            // Get AWS account ID from the ECS cluster metadata.json
            const ecsMetaPath = path.join(
                __dirname, `../../terraform/deployments/ecs/${ecsCluster}/metadata.json`
            );
            const ecsMeta = JSON.parse(fs.readFileSync(ecsMetaPath));
            const awsAccountId = ecsMeta.account;

            // Resolve credentials the same way infra delete does
            const userId = requestUserId || data.userId || null;
            const credentials = await infraController.resolveCredentialsPublic(
                awsAccountId, userId, region   // use the variable
            );

            // 4. Terraform destroy ecs-app directory
            const deploymentName = `${ecsCluster}-${appName}`;
            await terraformService.destroyInfra(deploymentName, 'ecs-app', credentials, region);

            // 5. Remove DB record only after successful destroy
            await db.query('DELETE FROM deployments WHERE id = $1', [id]);

        } catch (bgErr) {
            console.error('App delete failed:', bgErr.message);
            await db.query(
                `UPDATE deployments SET status = 'Delete Failed', updated_at = NOW(),
                 data = data || '{"status":"Delete Failed"}' WHERE id = $1`, [id]
            );
        }

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
};
