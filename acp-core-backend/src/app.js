const express = require("express");
const cors = require("cors");
require("dotenv").config();

const app = express();

app.use(cors());
app.use(express.json());

// Routes
const tenantRoutes = require("./routes/tenant.routes");
const deploymentRoutes = require("./routes/deployment.routes");
const blueprintRoutes = require("./routes/blueprint.routes");
const portfolioRoutes = require("./routes/portfolio.routes");
const accountRoutes = require("./routes/account.routes");
const infraRoutes = require("./routes/infra.routes");
const vpcRoutes = require("./routes/vpc.routes");
const githubRoutes = require('./routes/github.routes');

// API Version
app.use("/api/v1/tenants", tenantRoutes);
app.use("/api/v1/deployments", deploymentRoutes);
app.use("/api/v1/blueprints", blueprintRoutes);
app.use("/api/v1", portfolioRoutes);
app.use("/api/v1", accountRoutes);
app.use("/api/v1", infraRoutes);
app.use("/api/v1", vpcRoutes);
app.use('/api/v1/github', githubRoutes);

// Health
app.get("/health", (req, res) => {
  res.json({ status: "ACP Backend Running" });
});

const PORT = process.env.PORT || 8080;

app.listen(PORT, () => {
  console.log(`ACP Backend running on port ${PORT}`);
});