const express = require("express");
const cors = require("cors");
require("dotenv").config();
const db = require('./config/db');
const { loadGcpCredentials } = require('./config/gcp');

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
const authRoutes = require('./routes/auth.routes');
const cloudAccountRoutes = require('./routes/cloudAccount.routes');
const observabilityRoutes = require('./routes/observability.routes');
const securityRoutes = require('./routes/security.routes');
const aiopsRoutes = require('./routes/aiops.routes');

// API Version
app.use("/api/v1/tenants", tenantRoutes);
app.use("/api/v1/deployments", deploymentRoutes);
app.use("/api/v1/blueprints", blueprintRoutes);
app.use("/api/v1", portfolioRoutes);
app.use("/api/v1", accountRoutes);
app.use("/api/v1", infraRoutes);
app.use("/api/v1", vpcRoutes);
app.use('/api/v1/github', githubRoutes);
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/cloud-accounts', cloudAccountRoutes);
app.use('/api/v1/observability', observabilityRoutes);
app.use('/api/v1/security', securityRoutes);
app.use('/api/v1/aiops', aiopsRoutes);

// Health
app.get("/health", (req, res) => {
  res.json({ status: "ACP Backend Running" });
});

const PORT = process.env.PORT || 8080;

async function startServer() {
  await loadGcpCredentials();

  if (process.env.USE_DB === 'true') {
    try {
      await db.initSchema();
      app.listen(PORT, () => console.log(`ACP Backend running on port ${PORT}`));
    } catch (err) {
      console.error('DB init failed:', err.message);
      process.exit(1);
    }
  } else {
    app.listen(PORT, () => console.log(`ACP Backend running on port ${PORT} (DB skipped)`));
  }
}

startServer();
