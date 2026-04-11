const express = require('express');
const router = express.Router();
const githubController = require('../controllers/github.controller');

router.post('/workflows', githubController.getWorkflows);
router.post('/workflows/trigger', githubController.triggerWorkflow);
router.post('/deploy-ecs', githubController.deployToEcs);

router.get('/workflows/logs', githubController.getLogs);

module.exports = router;