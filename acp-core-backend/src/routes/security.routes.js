const express = require('express');
const router = express.Router();

const securityController = require('../controllers/security.controller');
const authMiddleware = require('../middleware/auth.middleware');

// ACP portal security posture (uses ECS task role directly — no account param needed)
router.get('/acp-security-posture', authMiddleware, securityController.getAcpSecurityPosture);

// Infra & App Deployment Security (deployed app's account — account param required)
router.get('/infra-vpc-security', authMiddleware, securityController.getInfraVpcSecurity);
router.get('/infra-rds-security', authMiddleware, securityController.getInfraRdsSecurity);
router.get('/infra-alb-security', authMiddleware, securityController.getInfraAlbSecurity);
router.get('/infra-ecs-security', authMiddleware, securityController.getInfraEcsSecurity);

module.exports = router;