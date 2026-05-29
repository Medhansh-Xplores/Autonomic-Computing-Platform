const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/azure.controller');
const authMiddleware = require('../middleware/auth.middleware');

router.use(authMiddleware); // protect all routes

router.get('/accounts', ctrl.getAzureAccounts);
router.get('/regions', ctrl.getAzureRegions);
router.get('/container-app-environments', ctrl.getContainerAppEnvironments);
router.get('/aks-clusters', ctrl.getAksClusters);
router.get('/app-service-plans', ctrl.getAppServicePlans);

module.exports = router;
