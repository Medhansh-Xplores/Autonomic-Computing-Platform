const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/auth.middleware");
const costController = require("../controllers/cost.controller");

router.post("/azure", authMiddleware, costController.estimateAzure);

module.exports = router;