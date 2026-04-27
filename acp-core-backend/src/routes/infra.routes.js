const express = require("express");
const router = express.Router();

const infraController = require("../controllers/infra.controller");
const authMiddleware = require('../middleware/auth.middleware');

router.post("/deployments/aws-rds", infraController.deployAwsRds);
router.get("/logs", authMiddleware, infraController.getLogs);
router.get("/deployments", authMiddleware, infraController.getDeployments);
router.get("/vpcs", authMiddleware, infraController.getVpcs);
router.get("/subnets", authMiddleware, infraController.getSubnets);
router.post("/deployments/aws-vpc", authMiddleware, infraController.createVPC);

module.exports = router;