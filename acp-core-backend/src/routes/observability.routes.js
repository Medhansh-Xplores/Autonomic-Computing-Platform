const express = require('express');
const router = express.Router();

const observabilityController = require('../controllers/observability.controller');
const authMiddleware = require('../middleware/auth.middleware');

router.get('/health', authMiddleware, observabilityController.getHealth);
router.get('/acp-portal-health', authMiddleware, observabilityController.getAcpPortalHealth);
router.get('/acp-portal-vpc-health', authMiddleware, observabilityController.getAcpVpcHealth);
router.get('/acp-portal-rds-health', authMiddleware, observabilityController.getAcpRdsHealth);
router.get('/acp-portal-alb-health', authMiddleware, observabilityController.getAcpAlbHealth);
router.get('/deployments-health', authMiddleware, observabilityController.getAllDeploymentsHealth);
router.get('/infra-vpc-health', authMiddleware, observabilityController.getInfraVpcHealth);
router.get('/infra-rds-health', authMiddleware, observabilityController.getInfraRdsHealth);
router.get('/infra-alb-health', authMiddleware, observabilityController.getInfraAlbHealth);
router.get('/infra-ecs-health', authMiddleware, observabilityController.getInfraEcsHealth);

module.exports = router;
