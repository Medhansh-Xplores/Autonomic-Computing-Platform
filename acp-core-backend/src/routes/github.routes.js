const express = require('express');
const router = express.Router();
const githubController = require('../controllers/github.controller');
const authMiddleware = require('../middleware/auth.middleware');

router.post('/workflows', githubController.getWorkflows);
router.post('/workflows/trigger', githubController.triggerWorkflow);
router.post('/deploy-ecs', authMiddleware, githubController.deployToEcs);

router.get('/workflows/logs', githubController.getLogs);
router.get("/listener-rules", authMiddleware, githubController.getListenerRules);
router.get('/terraform-logs', githubController.getTerraformLogs);
router.get('/pending-deployment', githubController.getPendingDeployment);

module.exports = router;