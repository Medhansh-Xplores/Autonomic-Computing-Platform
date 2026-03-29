const express = require("express");
const router = express.Router();

const infraController = require("../controllers/infra.controller");

router.post(
  "/deployments/aws-vpc",
  infraController.createVPC
);

router.get("/logs", infraController.getLogs);

router.get("/deployments", infraController.getDeployments);

router.get("/vpcs", infraController.getVpcs);

router.get("/subnets", infraController.getSubnets);

module.exports = router;