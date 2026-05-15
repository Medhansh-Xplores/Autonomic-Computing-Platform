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
router.get('/infra-vpc-detail', authMiddleware, observabilityController.getInfraVpcDetail);

router.get('/infra-rds-health', authMiddleware, observabilityController.getInfraRdsHealth);
router.get('/infra-rds-detail', authMiddleware, observabilityController.getInfraRdsDetail);

router.get('/infra-alb-health', authMiddleware, observabilityController.getInfraAlbHealth);
router.get('/infra-alb-detail', authMiddleware, observabilityController.getInfraAlbDetail);

router.get('/infra-ecs-health', authMiddleware, observabilityController.getInfraEcsHealth);
router.get('/infra-ecs-detail', authMiddleware, observabilityController.getInfraEcsDetail);

module.exports = router;
