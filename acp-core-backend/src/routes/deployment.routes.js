// src/routes/deployment.routes.js

const express = require("express");
const router = express.Router();

const infraController = require("../controllers/infra.controller");
const deploymentController = require("../controllers/deployments.controller");
const authMiddleware = require('../middleware/auth.middleware');

router.post("/aws-vpc", authMiddleware, infraController.createVPC);

router.post(
  "/aws-ecs",
  authMiddleware,
  infraController.createECS
);

router.post(
  "/aws-rds",
  authMiddleware,
  infraController.deployAwsRds
);

router.post("/AWS-EKS-FARGATE", (req, res) => {
  res.json({ message: "Deploy AWS EKS Fargate" });
});

router.post("/AZURE-VPC", (req, res) => {
  res.json({ message: "Deploy Azure VPC" });
});

router.post("/GCP-VPC", (req, res) => {
  res.json({ message: "Deploy GCP VPC" });
});

// Deployments
router.post("/create", authMiddleware, deploymentController.createDeployment);
router.get("/list", deploymentController.getDeployments);
router.patch("/:id/status", deploymentController.updateStatus);
router.delete("/record/:id", authMiddleware, deploymentController.deleteDeployment);

module.exports = router;