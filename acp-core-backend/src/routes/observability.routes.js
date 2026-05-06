const express = require('express');
const router = express.Router();

const observabilityController = require('../controllers/observability.controller');
const authMiddleware = require('../middleware/auth.middleware');

router.get('/health', authMiddleware, observabilityController.getHealth);
router.get('/acp-portal-health', authMiddleware, observabilityController.getAcpPortalHealth);
router.get('/deployments-health', authMiddleware, observabilityController.getAllDeploymentsHealth);

module.exports = router;
