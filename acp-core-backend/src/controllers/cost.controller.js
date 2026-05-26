const azureCostService = require("../services/azureCost.service");

exports.estimateAzure = async (req, res) => {
  try {
    const estimate = await azureCostService.estimateAzureInfrastructure(req.body || {});
    res.json({
      ...estimate,
      source: "Azure Retail Prices API",
      sourceUrl: "https://prices.azure.com/api/retail/prices"
    });
  } catch (err) {
    console.error("Azure cost estimate failed:", err.message);
    res.status(500).json({ error: err.message });
  }
};
