const express = require("express");
const router = express.Router();
const awsController = require("../controllers/aws.controller");
const db = require('../config/db');
const authMiddleware = require('../middleware/auth.middleware');

// AWS Accounts — fetch from DB instead of hardcoded
router.get("/tenants/:tenantid/accounts", authMiddleware, async (req, res) => {
  const userId = req.user.username;

  try {
    const result = await db.query(
      `SELECT account_id AS "accountID", account_name AS "accountName" 
       FROM cloud_accounts 
       WHERE user_id = $1 
       ORDER BY is_default DESC, created_at ASC`,
      [userId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to fetch accounts' });
  }
});

// AWS Regions
router.get("/aws/regions", awsController.getAwsRegions);

// AWS ECS Clusters
router.get("/aws/ecs-clusters", awsController.getAwsEcsClusters);

router.get("/aws/rds-instances", awsController.getAwsRdsInstances);

module.exports = router;