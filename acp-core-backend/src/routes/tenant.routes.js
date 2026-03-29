// src/routes/tenant.routes.js

const express = require("express");
const router = express.Router();

router.get("/:tenantId", (req, res) => {
  res.json({ message: "Get tenant", tenantId: req.params.tenantId });
});

router.get("/:tenantId/license", (req, res) => {
  res.json({ message: "Get license" });
});

router.put("/:tenantId/license", (req, res) => {
  res.json({ message: "Update license" });
});

router.get("/:tenantId/contacts", (req, res) => {
  res.json({ message: "Get contacts" });
});

router.put("/:tenantId/contacts", (req, res) => {
  res.json({ message: "Update contacts" });
});

router.get("/:tenantId/billing", (req, res) => {
  res.json({ message: "Get billing" });
});

router.put("/:tenantId/billing", (req, res) => {
  res.json({ message: "Update billing" });
});

module.exports = router;