const express = require("express");
const router = express.Router();

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

module.exports = router;