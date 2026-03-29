const express = require("express");
const router = express.Router();

router.get("/tenants/:tenantId/portfolios", (req, res) => {

  const portfolios = [
    {
      portfolioID: "ai",
      portfolioName: "AI Apps"
    },
    {
      portfolioID: "internal",
      portfolioName: "Internal Tools"
    },
    {
      portfolioID: "customer",
      portfolioName: "Customer Apps"
    }
  ];

  res.json(portfolios);

});

module.exports = router;