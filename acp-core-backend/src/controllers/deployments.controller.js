const deploymentService = require('../services/deployments.service');

exports.createDeployment = (req, res) => {

    const result = deploymentService.createDeployment(req.body);

    res.json(result);
};

exports.getDeployments = (req, res) => {
    try {

        const deployments = deploymentService.getDeployments();

        res.json(deployments);

    } catch (err) {

        console.error(err);

        res.status(500).json({
            error: "Failed to fetch deployments"
        });
    }
};

exports.updateStatus = (req, res) => {

    try {

        const { id } = req.params;
        const { status, url } = req.body;
        deploymentService.updateStatus(id, { status, url });

        res.json({ success: true });

    } catch (err) {

        console.error(err);
        res.status(500).json({ error: 'Failed to update status' });

    }

};
