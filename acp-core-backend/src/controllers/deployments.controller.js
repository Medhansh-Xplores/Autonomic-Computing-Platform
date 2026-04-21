const deploymentService = require('../services/deployments.service');

exports.createDeployment = async (req, res) => {
    try {
        const result = await deploymentService.createDeployment(req.body);
        res.json(result);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to create deployment' });
    }
};

exports.getDeployments = async (req, res) => {
    try {
        const deployments = await deploymentService.getDeployments();
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