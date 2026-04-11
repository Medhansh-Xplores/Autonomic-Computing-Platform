const express = require("express");
const router = express.Router();
const awsController = require("../controllers/aws.controller");

router.get("/tenants/:tenantid/accounts", (req, res) => {

  const platform = req.query.platformTypeFilter;

  const accounts = [
    {
      accountID: "377122171982",
      accountName: "Autonomic Root Account"
    }
  ];

  res.json(accounts);

});

// AWS Accounts
router.get("/aws/accounts", awsController.getAwsAccounts);

// AWS Regions
router.get("/aws/regions", awsController.getAwsRegions);

// AWS ECS Clusters
router.get("/aws/ecs-clusters", awsController.getAwsEcsClusters);

router.get("/aws/rds-instances", awsController.getAwsRdsInstances);

module.exports = router;