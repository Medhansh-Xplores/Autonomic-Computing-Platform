const express = require("express");
const router = express.Router();
const awsController = require("../controllers/aws.controller");
const db = require('../config/db');
const authMiddleware = require('../middleware/auth.middleware');

// AWS Accounts — fetch from DB instead of hardcoded
router.get("/tenants/:tenantid/accounts", authMiddleware, async (req, res) => {
  const userId = req.user.username;
  const { platformTypeFilter } = req.query;

  try {
    let query = `
      SELECT account_id AS "accountID", account_name AS "accountName" 
      FROM cloud_accounts 
      WHERE user_id = $1
    `;
    const params = [userId];

    if (platformTypeFilter) {
      query += ` AND LOWER(provider) = LOWER($2)`;
      params.push(platformTypeFilter);
    }

    query += ` ORDER BY is_default DESC, created_at ASC`;

    const result = await db.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to fetch accounts' });
  }
});

router.get("/aws/regions", authMiddleware, awsController.getAwsRegions);
router.get("/aws/ecs-clusters", authMiddleware, awsController.getAwsEcsClusters);
router.get("/aws/rds-instances", authMiddleware, awsController.getAwsRdsInstances);

router.get("/aws/accounts", authMiddleware, awsController.getAwsAccounts);

module.exports = router;