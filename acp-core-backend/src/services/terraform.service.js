const { exec } = require("child_process");
const path = require("path");
const fs = require("fs");
const deploymentService = require("./deployments.service");
const USE_DB = process.env.USE_DB === 'true';
let logs = [];

exports.createVPC = (data, credentials, userID) => {

  logs = [];

  const { v4: uuidv4 } = require('uuid');
  const id = uuidv4();

  const deploymentName = data.vpcName;

  const templateDir = path.join(
    __dirname,
    "../../terraform/templates/vpc"
  );

  const terraformDir = path.join(
    __dirname,
    `../../terraform/deployments/vpc/${deploymentName}`
  );

  if (!fs.existsSync(terraformDir)) {
    fs.mkdirSync(terraformDir, { recursive: true });
  }

  fs.cpSync(templateDir, terraformDir, { recursive: true });

  const tfvars = `
vpc_name         = "${data.vpcName}"
cidr             = "${data.cidr}"
public_subnet_1  = "${data.public_subnet_1}"
public_subnet_2  = "${data.public_subnet_2}"
private_subnet_1 = "${data.private_subnet_1}"
private_subnet_2 = "${data.private_subnet_2}"
region           = "${data.region}"
az_1             = "${data.az_1}"
az_2             = "${data.az_2}"
`;

  fs.writeFileSync(
    path.join(terraformDir, "terraform.tfvars"),
    tfvars
  );

  const metadata = {
    id,
    name: data.vpcName,
    type: "VPC",
    region: data.region,
    account: data.accountID,
    awsAccountId: data.awsAccountId || data.accountID,
    status: "Creating",
    cloud: data.cloud || "AWS",
    userId: userID
  };

  fs.writeFileSync(
    path.join(terraformDir, "metadata.json"),
    JSON.stringify(metadata, null, 2)
  );

  const command = `terraform init && terraform apply -auto-approve`;

  let child;

  try {
    child = exec(command, {
      cwd: terraformDir,
      env: {
        ...process.env,
        AWS_ACCESS_KEY_ID: credentials.accessKeyId,
        AWS_SECRET_ACCESS_KEY: credentials.secretAccessKey,
        AWS_SESSION_TOKEN: credentials.sessionToken,
        AWS_DEFAULT_REGION: data.region
      }
    });
  } catch (error) {
    console.error("Exec error:", error);
  }

  child.stdout.on("data", (chunk) => {
    logs.push(chunk.toString());
    console.log(chunk.toString());
  });

  child.stderr.on("data", (chunk) => {
    logs.push(chunk.toString());
    console.error(chunk.toString());
  });

  child.on("close", async (code) => {

    const metadataPath = path.join(terraformDir, "metadata.json");

    if (fs.existsSync(metadataPath)) {
      const metadata = JSON.parse(
        fs.readFileSync(metadataPath)
      );

      metadata.status = code === 0 ? "Active" : "Failed";

      fs.writeFileSync(
        metadataPath,
        JSON.stringify(metadata, null, 2)
      );

      if (USE_DB) {
        try {
          const db = require('../config/db');
          await db.query(
            `INSERT INTO infra_deployments (id, name, type, status, region, account, cloud, data, user_id)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
             ON CONFLICT (id) DO UPDATE SET status = $4, updated_at = NOW(), data = $8, user_id = $9`,
            [metadata.id, metadata.name, metadata.type, metadata.status,
            metadata.region, metadata.account, metadata.cloud, JSON.stringify(metadata), metadata.userId]
          );
        } catch (e) {
          console.error('Failed to save VPC to DB:', e.message);
        }
      }
    }

    logs.push(code === 0 ? "INFRA_CREATED" : "INFRA_FAILED");

  });

};

exports.getLogs = () => {
  try {
    return logs || [];
  } catch (error) {
    console.error("Logs error:", error);
    return [];
  }
};

exports.getDeployments = async (userId) => {

  if (USE_DB) {
    const db = require('../config/db');
    const result = userId
      ? await db.query(
        `SELECT id, data FROM infra_deployments WHERE user_id = $1 OR user_id IS NULL ORDER BY created_at DESC`,
        [userId]
      )
      : await db.query('SELECT id, data FROM infra_deployments ORDER BY created_at DESC');
    return result.rows.map(row => {
      const data = row.data || {};
      return {
        id: row.id,
        cloud: data.cloud || inferCloud(data.type),
        destroyedBy: data.destroyedBy || data.deletedBy || null,
        ...data
      };
    });
  }

  const deployments = [];

  const basePath = path.join(
    __dirname,
    "../../terraform/deployments"
  );

  const types = fs.readdirSync(basePath);

  types.forEach(type => {

    const typePath = path.join(basePath, type);

    const folders = fs.readdirSync(typePath);

    folders.forEach(folder => {

      const metadataPath = path.join(
        typePath,
        folder,
        "metadata.json"
      );

      if (fs.existsSync(metadataPath)) {

        const metadata = JSON.parse(
          fs.readFileSync(metadataPath, "utf8")
        );

        deployments.push({
          cloud: metadata.cloud || inferCloud(metadata.type),
          destroyedBy: metadata.destroyedBy || metadata.deletedBy || null,
          ...metadata
        });

      }

    });

  });

  return deployments;

};

function inferCloud(type) {
  const normalizedType = String(type || '').toLowerCase();

  if (normalizedType.startsWith('azure-')) {
    return "Azure";
  }

  if (["vpc", "ecs", "rds"].includes(normalizedType)) {
    return "AWS";
  }

  return "Unknown";
}

function findLocalDeploymentById(id) {
  const basePath = path.join(
    __dirname,
    "../../terraform/deployments"
  );

  if (!fs.existsSync(basePath)) {
    return null;
  }

  const types = fs.readdirSync(basePath);

  for (const type of types) {
    const typePath = path.join(basePath, type);

    if (!fs.statSync(typePath).isDirectory()) {
      continue;
    }

    const folders = fs.readdirSync(typePath);

    for (const folder of folders) {
      const deploymentPath = path.join(typePath, folder);
      const metadataPath = path.join(deploymentPath, "metadata.json");

      if (!fs.existsSync(metadataPath)) {
        continue;
      }

      const metadata = JSON.parse(fs.readFileSync(metadataPath, "utf8"));

      if (metadata.id === id) {
        return {
          metadata,
          deploymentPath
        };
      }
    }
  }

  return null;
}

exports.findLocalDeploymentById = findLocalDeploymentById;

exports.deleteLocalDeployment = async (id) => {
  const deployment = findLocalDeploymentById(id);

  if (!deployment) {
    throw new Error("Deployment not found");
  }

  const metadata = {
    ...deployment.metadata,
    status: "Destroyed",
    destroyedBy: "Portal",
    destroyedAt: new Date().toISOString()
  };

  fs.writeFileSync(
    path.join(deployment.deploymentPath, "metadata.json"),
    JSON.stringify(metadata, null, 2)
  );

  logs = ["INFRA_DESTROYED"];

  return metadata;
};

exports.deleteLocalDeploymentByNameAndType = async (name, type) => {
  const azureTypeDirMap = {
    "Azure-VNet": "azure-vnet",
    "Azure-Container-Apps": "azure-container-apps",
    "Azure-DB": "azure-db",
    "Azure-AKS": "azure-aks"
  };

  const typeDir = azureTypeDirMap[type] || String(type || '').toLowerCase();
  const deploymentPath = path.join(
    __dirname,
    `../../terraform/deployments/${typeDir}/${name}`
  );

  if (!fs.existsSync(deploymentPath)) {
    throw new Error(`Deployment directory not found: ${deploymentPath}`);
  }

  const metadataPath = path.join(deploymentPath, "metadata.json");

  if (fs.existsSync(metadataPath)) {
    const metadata = JSON.parse(fs.readFileSync(metadataPath, "utf8"));
    metadata.status = "Destroyed";
    metadata.destroyedBy = "Portal";
    metadata.destroyedAt = new Date().toISOString();
    fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));
  }

  logs = ["INFRA_DESTROYED"];
};

exports.createECS = (data, credentials, userID) => {

  logs = [];

  // Validate FIRST
  if (
    !data.region ||
    !data.clusterName ||
    !data.vpcId ||
    !data.cpu ||
    !data.memory ||
    !data.zoneName
  ) {
    throw new Error("Missing required ECS parameters");
  }

  const { v4: uuidv4 } = require('uuid');
  const id = uuidv4();

  const deploymentName = data.zoneName;

  const templatePath = path.join(__dirname, "../../terraform/templates/ecs");
  const deploymentPath = path.join(__dirname, `../../terraform/deployments/ecs/${deploymentName}`);

  fs.mkdirSync(deploymentPath, { recursive: true });
  fs.cpSync(templatePath, deploymentPath, { recursive: true });

  const metadata = {
    id,
    name: data.zoneName,
    type: "ECS",
    region: data.region,
    account: data.accountID || data.account,
    awsAccountId: data.awsAccountId || data.accountID,
    status: "Creating",
    cloud: "AWS",
    vpcId: data.vpcId,
    clusterName: data.clusterName,
    cpu: data.cpu,
    memory: data.memory,
    userId: userID
  };

  fs.writeFileSync(
    path.join(deploymentPath, "metadata.json"),
    JSON.stringify(metadata, null, 2)
  );

  const tfvars = `
cluster_name = "${data.clusterName}"
region       = "${data.region}"
vpc_id       = "${data.vpcId}"
created_by   = "ACP-Portal"
`;

  fs.writeFileSync(
    path.join(deploymentPath, "terraform.tfvars"),
    tfvars
  );

  const command = `terraform init && terraform apply -auto-approve`;

  let child;
  try {
    child = exec(command, {
      cwd: deploymentPath,
      env: {
        ...process.env,
        AWS_ACCESS_KEY_ID: credentials.accessKeyId,
        AWS_SECRET_ACCESS_KEY: credentials.secretAccessKey,
        AWS_SESSION_TOKEN: credentials.sessionToken,
        AWS_DEFAULT_REGION: data.region
      }
    });
  } catch (error) {
    console.error("ECS Exec Error:", error);
    throw error;
  }

  child.stdout.on("data", (chunk) => { logs.push(chunk.toString()); console.log(chunk.toString()); });
  child.stderr.on("data", (chunk) => { logs.push(chunk.toString()); console.error(chunk.toString()); });

  child.on("close", async (code) => {

    const metadataPath = path.join(deploymentPath, "metadata.json");

    if (fs.existsSync(metadataPath)) {
      const metadata = JSON.parse(fs.readFileSync(metadataPath));

      metadata.status = code === 0 ? "Active" : "Failed";

      fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));

      if (USE_DB) {
        try {
          const db = require('../config/db');
          await db.query(
            `INSERT INTO infra_deployments (id, name, type, status, region, account, cloud, data, user_id)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
             ON CONFLICT (id) DO UPDATE SET status = $4, updated_at = NOW(), data = $8, user_id = $9`,
            [metadata.id, metadata.name, metadata.type, metadata.status,
            metadata.region, metadata.account, metadata.cloud, JSON.stringify(metadata), metadata.userId]
          );
        } catch (e) {
          console.error('Failed to save ECS to DB:', e.message);
        }
      }
    }

    logs.push(code === 0 ? "INFRA_CREATED" : "INFRA_FAILED");
  });

};

exports.deployAwsRds = (data, credentials, userID) => {

  logs = [];

  if (
    !data.accountID || !data.region || !data.rdsIdentifier ||
    !data.dbEngine || !data.username || !data.password ||
    !data.vpcId || !data.zoneName
  ) {
    throw new Error("Missing required RDS parameters");
  }

  const deploymentName = data.zoneName;
  const deploymentPath = path.join(__dirname, `../../terraform/deployments/rds/${deploymentName}`);
  const templatePath = path.join(__dirname, "../../terraform/templates/rds");

  fs.mkdirSync(deploymentPath, { recursive: true });
  fs.cpSync(templatePath, deploymentPath, { recursive: true });

  // Generate id ONCE here so it's reused in the DB insert
  const { v4: uuidv4 } = require('uuid');
  const id = uuidv4();

  const metadata = {
    id,                                    // ← store id in metadata
    name: data.zoneName,
    type: "RDS",
    region: data.region,
    account: data.accountID,
    awsAccountId: data.awsAccountId || data.accountID,
    status: "Creating",
    cloud: "AWS",
    rdsIdentifier: data.rdsIdentifier,
    dbEngine: data.dbEngine,
    vpcId: data.vpcId,
    dbUsername: data.username,
    dbPassword: data.password,
    dbName: data.initialDbName || '',
    userId: userID
  };

  fs.writeFileSync(
    path.join(deploymentPath, "metadata.json"),
    JSON.stringify(metadata, null, 2)
  );

  const dbPort = data.dbEngine === 'mysql' ? 3306 : 5432;
  const subnetList = data.subnet_ids.map(s => `"${s}"`).join(", ");

  // No leading spaces in tfvars
  const tfvars = `
region          = "${data.region}"
rds_identifier  = "${data.rdsIdentifier}"
db_engine       = "${data.dbEngine}"
db_username     = "${data.username}"
db_password     = "${data.password}"
vpc_id          = "${data.vpcId}"
subnet_ids      = [${subnetList}]
create_db       = ${data.createInitialDb || false}
initial_db_name = "${data.initialDbName || ""}"
zone_name       = "${data.zoneName}"
db_port         = ${dbPort}
`;

  fs.writeFileSync(path.join(deploymentPath, "terraform.tfvars"), tfvars);

  const command = `terraform init && terraform apply -auto-approve`;

  let child;
  try {
    child = exec(command, {
      cwd: deploymentPath,
      env: {
        ...process.env,
        AWS_ACCESS_KEY_ID: credentials.accessKeyId,
        AWS_SECRET_ACCESS_KEY: credentials.secretAccessKey,
        AWS_SESSION_TOKEN: credentials.sessionToken,
        AWS_DEFAULT_REGION: data.region
      }
    });
  } catch (error) {
    console.error("RDS Exec Error:", error);
    throw error;
  }

  // Renamed to "chunk" to avoid shadowing outer "data"
  child.stdout.on("data", (chunk) => { logs.push(chunk.toString()); console.log(chunk.toString()); });
  child.stderr.on("data", (chunk) => { logs.push(chunk.toString()); console.error(chunk.toString()); });

  child.on("close", async (code) => {

    const metadataPath = path.join(deploymentPath, "metadata.json");

    if (fs.existsSync(metadataPath)) {
      const metadata = JSON.parse(fs.readFileSync(metadataPath));

      metadata.status = code === 0 ? "Active" : "Failed";

      if (code === 0) {
        try {
          const { execSync } = require("child_process");
          const outputs = JSON.parse(
            execSync("terraform output -json", { cwd: deploymentPath }).toString()
          );
          if (outputs.rds_endpoint?.value) {
            const [host, port] = outputs.rds_endpoint.value.split(":");
            metadata.rdsEndpoint = host;
            // "data" is now safely the outer request data (not shadowed)
            const enginePortMap = { mysql: '3306', postgres: '5432', aurora: '3306' };
            const engineKey = (data.dbEngine || '').toLowerCase();
            const matchedKey = Object.keys(enginePortMap).find(k => engineKey.includes(k));
            metadata.rdsPort = port || enginePortMap[matchedKey] || '3306';
          }
        } catch (e) {
          console.error("Could not capture RDS endpoint:", e.message);
        }
      }

      fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));

      if (USE_DB) {
        try {
          const db = require('../config/db');
          await db.query(
            `INSERT INTO infra_deployments (id, name, type, status, region, account, cloud, data, user_id)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
             ON CONFLICT (id) DO UPDATE SET status = $4, updated_at = NOW(), data = $8, user_id = $9`,
            // Use metadata.id (fixed uuid) not uuidv4() (new uuid every time)
            [metadata.id, metadata.name, metadata.type, metadata.status,
            metadata.region, metadata.account, metadata.cloud, JSON.stringify(metadata), metadata.userId]
          );
        } catch (e) {
          console.error('Failed to save RDS to DB:', e.message);
        }
      }
    }

    logs.push(code === 0 ? "INFRA_CREATED" : "INFRA_FAILED");
  });
};

exports.createECSApp = async (data, credentials) => {
  return new Promise(async (resolve, reject) => {
    logs = [];

    const deploymentName = `${data.zoneName}-${data.appName}`;

    const templatePath = path.join(__dirname, "../../terraform/templates/ecs-app");
    const deploymentPath = path.join(__dirname, `../../terraform/deployments/ecs-app/${deploymentName}`);

    fs.mkdirSync(deploymentPath, { recursive: true });
    fs.cpSync(templatePath, deploymentPath, { recursive: true });

    const roleArn = `arn:aws:iam::${data.account}:role/ACPDeploymentRole`;
    let dbHost = '', dbPort = '5432', dbUser = '', dbPassword = '', dbName = '';

    if (data.rdsName && USE_DB) {
      try {
        const db = require('../config/db');
        const result = await db.query(
          `SELECT data FROM infra_deployments WHERE data->>'rdsIdentifier' = $1 AND type = 'RDS' LIMIT 1`,
          [data.rdsName]
        );
        if (result.rows.length) {
          const rds = result.rows[0].data;
          dbHost = rds.rdsEndpoint || '';
          dbPort = rds.rdsPort || '5432';
          dbUser = rds.dbUsername || '';
          dbPassword = rds.dbPassword || '';
          dbName = rds.dbName || '';
        }
      } catch (e) {
        console.error('Failed to fetch RDS metadata:', e.message);
      }
    }

    const tfvars = `
region     = "${data.region}"

app_name   = "${data.appName}"
zone_name  = "${data.zoneName}"
vpc_id     = "${data.vpcId}"

cluster_id         = "${data.clusterId}"
execution_role_arn = "${data.executionRoleArn}"
log_group_name     = "${data.logGroupName}"
http_listener_arn  = "${data.httpListenerArn}"
security_group_id  = "${data.securityGroupId}"
private_subnet_ids = ${JSON.stringify(data.privateSubnetIds)}

cpu            = ${data.cpu || 256}
memory         = ${data.memory || 512}
container_port = ${data.containerPort || 3000}

listener_priority          = ${data.listenerPriority || 100}
path_patterns              = ${JSON.stringify(data.pathPatterns || ["/api/*"])}
frontend_listener_priority = ${data.frontendListenerPriority || 101}
frontend_path_patterns     = ${JSON.stringify(data.frontendPathPatterns || ["/*"])}

environment_variables = [
  { name = "USE_DB",      value = "true" },
  { name = "DB_HOST",     value = "${dbHost}" },
  { name = "DB_PORT",     value = "${dbPort}" },
  { name = "DB_USER",     value = "${dbUser}" },
  { name = "DB_PASSWORD", value = "${dbPassword}" },
  { name = "DB_NAME",     value = "${dbName}" }
]
`;

    fs.writeFileSync(path.join(deploymentPath, "terraform.tfvars"), tfvars);

    const command = `terraform init && terraform apply -auto-approve`;
    const child = exec(command, {
      cwd: deploymentPath,
      env: {
        ...process.env,
        AWS_ACCESS_KEY_ID: credentials.accessKeyId,
        AWS_SECRET_ACCESS_KEY: credentials.secretAccessKey,
        AWS_SESSION_TOKEN: credentials.sessionToken,
        AWS_DEFAULT_REGION: data.region
      }
    });

    child.stdout.on("data", d => logs.push(d.toString()));
    child.stderr.on("data", d => logs.push(d.toString()));

    child.on("close", (code) => {

      // ❌ Terraform failed
      if (code !== 0) {
        logs.push("INFRA_FAILED");   // 🚀 ADD THIS
        return reject(new Error("ecs-app terraform failed"));
      }

      try {
        const { execSync } = require("child_process");

        const outputs = JSON.parse(
          execSync("terraform output -json", { cwd: deploymentPath }).toString()
        );

        logs.push("INFRA_CREATED");  // 🚀 ADD THIS

        resolve({
          frontendEcrUrl: outputs.frontend_ecr_url?.value,
          backendEcrUrl: outputs.backend_ecr_url?.value,
        });

      } catch (e) {

        // ⚠️ Even if outputs fail, infra is created
        logs.push("INFRA_CREATED");  // 🚀 ADD THIS

        resolve({});
      }
    });
  });
};

function getDeploymentTypeDir(type) {
  const typeDirMap = {
    "VPC": "vpc",
    "ECS": "ecs",
    "RDS": "rds",
    "Azure-VNet": "azure-vnet",
    "Azure-Container-Apps": "azure-container-apps",
    "Azure-DB": "azure-db",
    "Azure-AKS": "azure-aks"
  };

  return typeDirMap[type] || String(type || '').toLowerCase();
}

async function saveInfraMetadata(metadata) {
  if (!USE_DB) {
    return;
  }

  try {
    const db = require('../config/db');
    await db.query(
      `INSERT INTO infra_deployments (id, name, type, status, region, account, cloud, data, user_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (id) DO UPDATE SET status = $4, updated_at = NOW(), data = $8, user_id = $9`,
      [metadata.id, metadata.name, metadata.type, metadata.status,
      metadata.region, metadata.account, metadata.cloud, JSON.stringify(metadata), metadata.userId]
    );
  } catch (e) {
    console.error(`Failed to save ${metadata.type} to DB:`, e.message);
  }
}

function azureEnv(creds) {
  if (!creds || !creds.subscription_id || !creds.tenant_id || !creds.client_id || !creds.client_secret) {
    return {};
  }

  return {
    ARM_SUBSCRIPTION_ID: creds.subscription_id,
    ARM_TENANT_ID: creds.tenant_id,
    ARM_CLIENT_ID: creds.client_id,
    ARM_CLIENT_SECRET: creds.client_secret
  };
}

function writeTfvars(deploymentPath, tfvars) {
  fs.writeFileSync(path.join(deploymentPath, "terraform.tfvars"), tfvars);
}

function runAzureTerraformDeployment({ data, creds, templateName, typeName, deploymentName, tfvars, metadata }) {
  logs = [];

  const templatePath = path.join(__dirname, `../../terraform/templates/${templateName}`);
  const deploymentPath = path.join(__dirname, `../../terraform/deployments/${templateName}/${deploymentName}`);

  fs.mkdirSync(deploymentPath, { recursive: true });
  fs.cpSync(templatePath, deploymentPath, { recursive: true });

  fs.writeFileSync(
    path.join(deploymentPath, "metadata.json"),
    JSON.stringify(metadata, null, 2)
  );

  writeTfvars(deploymentPath, tfvars);

  const command = `terraform init && terraform apply -auto-approve`;

  let child;
  try {
    child = exec(command, {
      cwd: deploymentPath,
      env: {
        ...process.env,
        ...azureEnv(creds)
      }
    });
  } catch (error) {
    console.error(`${typeName} Exec Error:`, error);
    throw error;
  }

  child.stdout.on("data", (chunk) => { logs.push(chunk.toString()); console.log(chunk.toString()); });
  child.stderr.on("data", (chunk) => { logs.push(chunk.toString()); console.error(chunk.toString()); });

  child.on("close", async (code) => {
    const metadataPath = path.join(deploymentPath, "metadata.json");

    if (fs.existsSync(metadataPath)) {
      const nextMetadata = JSON.parse(fs.readFileSync(metadataPath, "utf8"));

      nextMetadata.status = code === 0 ? "Active" : "Failed";

      if (code === 0) {
        try {
          const { execSync } = require("child_process");
          const outputs = JSON.parse(
            execSync("terraform output -json", { cwd: deploymentPath }).toString()
          );

          nextMetadata.outputs = Object.fromEntries(
            Object.entries(outputs).map(([key, output]) => [key, output.value])
          );
        } catch (e) {
          console.error(`Could not capture ${typeName} outputs:`, e.message);
        }
      }

      fs.writeFileSync(metadataPath, JSON.stringify(nextMetadata, null, 2));
      await saveInfraMetadata(nextMetadata);
    }

    logs.push(code === 0 ? "INFRA_CREATED" : "INFRA_FAILED");
  });
}

// terraform.service.js
exports.destroyInfra = async (deploymentName, type, credentials, region) => {
  const typeDir = getDeploymentTypeDir(type);
  const deploymentPath = path.join(
    __dirname,
    `../../terraform/deployments/${typeDir}/${deploymentName}`
  );

  if (!fs.existsSync(deploymentPath)) {
    throw new Error(`Terraform directory not found: ${deploymentPath}`);
  }

  return new Promise((resolve, reject) => {
    logs = [];

    const command = `terraform destroy -auto-approve`;
    const destroyEnv = {
      ...process.env,
      ...azureEnv(credentials),
    };

    if (credentials.accessKeyId && credentials.secretAccessKey) {
      destroyEnv.AWS_ACCESS_KEY_ID = credentials.accessKeyId;
      destroyEnv.AWS_SECRET_ACCESS_KEY = credentials.secretAccessKey;
      destroyEnv.AWS_SESSION_TOKEN = credentials.sessionToken;
      destroyEnv.AWS_DEFAULT_REGION = region;
    }

    const child = exec(command, {
      cwd: deploymentPath,
      env: destroyEnv,
    });

    child.stdout.on("data", (d) => { logs.push(d.toString()); console.log(d.toString()); });
    child.stderr.on("data", (d) => { logs.push(d.toString()); console.error(d.toString()); });

    child.on("close", async (code) => {
      if (code !== 0) {
        logs.push("INFRA_DESTROY_FAILED");
        return reject(new Error("terraform destroy failed"));
      }

      const metadataPath = path.join(deploymentPath, "metadata.json");

      if (fs.existsSync(metadataPath)) {
        const metadata = JSON.parse(fs.readFileSync(metadataPath, "utf8"));
        metadata.status = "Destroyed";
        metadata.destroyedBy = "Portal";
        metadata.destroyedAt = new Date().toISOString();
        fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));
      }

      logs.push("INFRA_DESTROYED");
      resolve();
    });
  });
};

/* ============================================================
   Helper — simulate an Azure deployment and write metadata
   ============================================================ */
function runAzureDeployment({ data, creds, typeName, typeDir, extraMeta = {} }) {
  logs = [];

  const { v4: uuidv4 } = require('uuid');
  const id = uuidv4();

  const deploymentName = data.vnetName || data.containerAppName ||
                         data.serverIdentifier || data.clusterName || data.zoneName;

  const deploymentPath = path.join(
    __dirname,
    `../../terraform/deployments/azure-${typeDir}/${deploymentName}`
  );
  fs.mkdirSync(deploymentPath, { recursive: true });

  const metadata = {
    id,
    name: deploymentName,
    type: typeName,
    region: data.region,
    account: data.accountID,
    status: "Creating",
    cloud: "Azure",
    subscriptionId: creds.subscription_id,
    tenantId: creds.tenant_id,
    ...extraMeta
  };

  fs.writeFileSync(
    path.join(deploymentPath, "metadata.json"),
    JSON.stringify(metadata, null, 2)
  );

  // Simulate realistic Terraform-style log output
  const fakeLogs = [
    `Initializing the backend...`,
    `Initializing provider plugins...`,
    `- Finding hashicorp/azurerm versions...`,
    `- Installing hashicorp/azurerm v3.x...`,
    `Terraform has been successfully initialized!`,
    `azurerm_resource_group.rg: Creating...`,
    `azurerm_resource_group.rg: Creation complete after 3s`,
    `azurerm_${typeDir.replace('-','_')}.main: Creating...`,
    `azurerm_${typeDir.replace('-','_')}.main: Still creating... [10s elapsed]`,
    `azurerm_${typeDir.replace('-','_')}.main: Creation complete after 20s`,
    `Apply complete! Resources: 3 added, 0 changed, 0 destroyed.`,
    `INFRA_CREATED`
  ];

  // Write logs with small delays to simulate real execution
  let delay = 0;
  fakeLogs.forEach(line => {
    setTimeout(() => {
      logs.push(line);
      console.log(`[Azure/${typeName}] ${line}`);
    }, delay);
    delay += 300;
  });

  // After simulated delay, update metadata status and persist to DB
  setTimeout(async () => {
    metadata.status = "Active";
    fs.writeFileSync(
      path.join(deploymentPath, "metadata.json"),
      JSON.stringify(metadata, null, 2)
    );

    if (USE_DB) {
      try {
        const db = require('../config/db');
        await db.query(
          `INSERT INTO infra_deployments (id, name, type, status, region, account, cloud, data)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           ON CONFLICT (id) DO UPDATE SET status = $4, updated_at = NOW(), data = $8`,
          [metadata.id, metadata.name, metadata.type, metadata.status,
           metadata.region, metadata.account, metadata.cloud, JSON.stringify(metadata)]
        );
      } catch (e) {
        console.error(`Failed to save Azure ${typeName} to DB:`, e.message);
      }
    }
  }, delay + 500);
}

/* ============================================================
   Azure — Virtual Network (VNet)
   ============================================================ */
exports.createAzureVPC = (data, creds, userID) => {
  if (!data.accountID || !data.region || !data.vnetName || !data.cidr || !data.zoneName) {
    throw new Error("Missing required Azure VNet parameters");
  }

  const { v4: uuidv4 } = require('uuid');
  const deploymentName = data.vnetName;
  const resourceGroupName = `rg-${deploymentName}`;
  const subnetCidr = data.subnetCidr || data.subnet_cidr || "10.0.1.0/24";

  runAzureTerraformDeployment({
    data,
    creds,
    templateName: "azure-vnet",
    typeName: "Azure-VNet",
    deploymentName,
    tfvars: `
region              = "${data.region}"
resource_group_name = "${resourceGroupName}"
vnet_name           = "${data.vnetName}"
cidr                = "${data.cidr}"
subnet_name         = "${data.subnetName || "default"}"
subnet_cidr         = "${subnetCidr}"
tags = {
  CreatedBy = "ACP-Portal"
  ZoneName  = "${data.zoneName}"
}
`,
    metadata: {
      id: uuidv4(),
      name: deploymentName,
      type: "Azure-VNet",
      region: data.region,
      account: data.accountID,
      status: "Creating",
      cloud: "Azure",
      userId: userID,
      subscriptionId: creds.subscription_id,
      tenantId: creds.tenant_id,
      resourceGroupName,
      vnetName: data.vnetName,
      cidr: data.cidr,
      subnetCidr
    }
  });
};

/* ============================================================
   Azure - Container Apps
   ============================================================ */
exports.createAzureContainerApps = (data, creds, userID) => {
  const containerAppName = data.containerAppName;

  if (!data.accountID || !data.region || !containerAppName || !data.cpu || !data.memory || !data.zoneName) {
    throw new Error("Missing required Azure Container Apps parameters");
  }

  const { v4: uuidv4 } = require('uuid');
  const deploymentName = containerAppName;
  const resourceGroupName = `rg-${deploymentName}`;
  const environmentName = data.containerAppEnvironmentName || `${deploymentName}-env`;

  runAzureTerraformDeployment({
    data,
    creds,
    templateName: "azure-container-apps",
    typeName: "Azure-Container-Apps",
    deploymentName,
    tfvars: `
region                          = "${data.region}"
resource_group_name             = "${resourceGroupName}"
container_app_name              = "${containerAppName}"
container_app_environment_name  = "${environmentName}"
container_name                  = "${data.containerName || "app"}"
image                           = "${data.image || "mcr.microsoft.com/azuredocs/containerapps-helloworld:latest"}"
cpu                             = ${Number(data.cpu)}
memory                          = ${Number(data.memory)}
port                            = ${Number(data.port || 80)}
tags = {
  CreatedBy = "ACP-Portal"
  ZoneName  = "${data.zoneName}"
}
`,
    metadata: {
      id: uuidv4(),
      name: deploymentName,
      type: "Azure-Container-Apps",
      region: data.region,
      account: data.accountID,
      status: "Creating",
      cloud: "Azure",
      userId: userID,
      subscriptionId: creds.subscription_id,
      tenantId: creds.tenant_id,
      resourceGroupName,
      containerAppName,
      containerAppEnvironmentName: environmentName,
      cpu: data.cpu,
      memory: data.memory,
      image: data.image || "mcr.microsoft.com/azuredocs/containerapps-helloworld:latest",
      port: data.port || 80
    }
  });
};

/* ============================================================
   Azure — SQL / PostgreSQL Database
   ============================================================ */
exports.deployAzureDB = (data, creds, userID) => {
  if (
    !data.accountID || !data.region || !data.serverIdentifier ||
    !data.dbEngine || !data.dbUsername || !data.dbPassword || !data.zoneName
  ) {
    throw new Error("Missing required Azure Database parameters");
  }

  const { v4: uuidv4 } = require('uuid');
  const deploymentName = data.serverIdentifier;
  const resourceGroupName = `rg-${deploymentName}`;
  const dbEngine = data.dbEngine || "postgres";

  runAzureTerraformDeployment({
    data,
    creds,
    templateName: "azure-db",
    typeName: "Azure-DB",
    deploymentName,
    tfvars: `
region              = "${data.region}"
resource_group_name = "${resourceGroupName}"
server_identifier   = "${data.serverIdentifier}"
db_engine           = "${dbEngine}"
db_username         = "${data.dbUsername}"
db_password         = "${data.dbPassword}"
create_db           = ${data.createInitialDb || false}
initial_db_name     = "${data.initialDbName || ""}"
tags = {
  CreatedBy = "ACP-Portal"
  ZoneName  = "${data.zoneName}"
}
`,
    metadata: {
      id: uuidv4(),
      name: deploymentName,
      type: "Azure-DB",
      region: data.region,
      account: data.accountID,
      status: "Creating",
      cloud: "Azure",
      userId: userID,
      subscriptionId: creds.subscription_id,
      tenantId: creds.tenant_id,
      resourceGroupName,
      serverIdentifier: data.serverIdentifier,
      dbEngine,
      dbUsername: data.dbUsername,
      initialDbName: data.initialDbName || ''
    }
  });
};

/* ============================================================
   Azure — Kubernetes Service (AKS)
   ============================================================ */
exports.createAzureAKS = (data, creds, userID) => {
  if (!data.accountID || !data.region || !data.clusterName || !data.zoneName) {
    throw new Error("Missing required Azure AKS parameters");
  }

  const { v4: uuidv4 } = require('uuid');
  const deploymentName = data.clusterName;
  const resourceGroupName = `rg-${deploymentName}`;
  const dnsPrefix = `${deploymentName}`.toLowerCase().replace(/[^a-z0-9-]/g, "-");

  runAzureTerraformDeployment({
    data,
    creds,
    templateName: "azure-aks",
    typeName: "Azure-AKS",
    deploymentName,
    tfvars: `
region              = "${data.region}"
resource_group_name = "${resourceGroupName}"
cluster_name        = "${data.clusterName}"
dns_prefix          = "${data.dnsPrefix || dnsPrefix}"
node_count          = ${Number(data.nodeCount || 1)}
vm_size             = "${data.vmSize || "Standard_B2s"}"
tags = {
  CreatedBy = "ACP-Portal"
  ZoneName  = "${data.zoneName}"
}
`,
    metadata: {
      id: uuidv4(),
      name: deploymentName,
      type: "Azure-AKS",
      region: data.region,
      account: data.accountID,
      status: "Creating",
      cloud: "Azure",
      userId: userID,
      subscriptionId: creds.subscription_id,
      tenantId: creds.tenant_id,
      resourceGroupName,
      clusterName: data.clusterName,
      nodeCount: data.nodeCount || 1,
      vmSize: data.vmSize || "Standard_B2s"
    }
  });
};
