const express = require('express');
const router = express.Router();

const securityController = require('../controllers/security.controller');
const authMiddleware = require('../middleware/auth.middleware');

// ACP portal security posture (uses ECS task role directly — no account param needed)
router.get('/acp-security-posture', authMiddleware, securityController.getAcpSecurityPosture);

module.exports = router;
