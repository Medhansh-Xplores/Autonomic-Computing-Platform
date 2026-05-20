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
        `SELECT id, data FROM infra_deployments WHERE user_id = $1 ORDER BY created_at DESC`,
        [userId]
      )
      : await db.query('SELECT id, data FROM infra_deployments ORDER BY created_at DESC');
    return result.rows.map(row => ({ id: row.id, ...row.data }));
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

        deployments.push(metadata);

      }

    });

  });

  return deployments;

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

// terraform.service.js
exports.destroyInfra = async (deploymentName, type, credentials, region) => {
  const typeDir = type.toLowerCase(); // "vpc", "rds", "ecs"
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

    const child = exec(command, {
      cwd: deploymentPath,
      env: {
        ...process.env,
        AWS_ACCESS_KEY_ID: credentials.accessKeyId,
        AWS_SECRET_ACCESS_KEY: credentials.secretAccessKey,
        AWS_SESSION_TOKEN: credentials.sessionToken,
        AWS_DEFAULT_REGION: region,
      },
    });

    child.stdout.on("data", (d) => { logs.push(d.toString()); console.log(d.toString()); });
    child.stderr.on("data", (d) => { logs.push(d.toString()); console.error(d.toString()); });

    child.on("close", async (code) => {
      if (code !== 0) {
        logs.push("INFRA_DESTROY_FAILED");
        return reject(new Error("terraform destroy failed"));
      }

      // Clean up local terraform directory
      fs.rmSync(deploymentPath, { recursive: true, force: true });
      logs.push("INFRA_DESTROYED");
      resolve();
    });
  });
};