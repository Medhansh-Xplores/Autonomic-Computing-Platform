const express = require("express");
const router = express.Router();

const infraController = require("../controllers/infra.controller");
const authMiddleware = require('../middleware/auth.middleware');

router.get("/logs", authMiddleware, infraController.getLogs);
router.get("/logs/:id", authMiddleware, infraController.getLogs);
router.get("/deployments", authMiddleware, infraController.getDeployments);
router.get("/vpcs", authMiddleware, infraController.getVpcs);
router.get("/subnets", authMiddleware, infraController.getSubnets);
router.post("/deployments/aws-vpc", authMiddleware, infraController.createVPC);
router.post("/deployments/aws-ecs", authMiddleware, infraController.createECS);
router.post("/deployments/aws-rds", authMiddleware, infraController.deployAwsRds);
router.delete("/deployments/:id", authMiddleware, infraController.deleteInfra);

module.exports = router;