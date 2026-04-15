const { exec } = require("child_process");
const path = require("path");
const fs = require("fs");

let logs = [];

exports.createVPC = (data) => {

  logs = [];

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

  const metadata = {
    name: data.vpcName,
    type: "VPC",
    region: data.region,
    account: data.accountID,
    status: "Creating",
    cloud: data.cloud || "AWS"
  };

  fs.writeFileSync(
    path.join(terraformDir, "metadata.json"),
    JSON.stringify(metadata, null, 2)
  );

  const roleArn =
    `arn:aws:iam::${data.accountID}:role/ACPDeploymentRole`;

  const command = `
  terraform init &&
  terraform apply -auto-approve \
  -var="vpc_name=${data.vpcName}" \
  -var="cidr=${data.cidr}" \
  -var="public_subnet_1=${data.public_subnet_1}" \
  -var="public_subnet_2=${data.public_subnet_2}" \
  -var="private_subnet_1=${data.private_subnet_1}" \
  -var="private_subnet_2=${data.private_subnet_2}" \
  -var="region=${data.region}" \
  -var="az_1=${data.az_1}" \
  -var="az_2=${data.az_2}" \
  -var="role_arn=${roleArn}"
  `;

  let child;

  try {
    child = exec(command, { cwd: terraformDir });
  } catch (error) {
    console.error("Exec error:", error);
  }

  child.stdout.on("data", (data) => {
    logs.push(data.toString());
    console.log(data.toString());
  });

  child.stderr.on("data", (data) => {
    logs.push(data.toString());
    console.error(data.toString());
  });

  child.on("close", () => {

    const metadataPath = path.join(terraformDir, "metadata.json");

    if (fs.existsSync(metadataPath)) {
      const metadata = JSON.parse(
        fs.readFileSync(metadataPath)
      );

      metadata.status = "Active";

      fs.writeFileSync(
        metadataPath,
        JSON.stringify(metadata, null, 2)
      );
    }

    logs.push("INFRA_CREATED");

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

exports.getDeployments = () => {

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

exports.createECS = (data) => {

  logs = [];

  // -------------------------------
  // Validate Request
  // -------------------------------
  if (
    !data.account ||
    !data.region ||
    !data.clusterName ||
    !data.vpcId ||
    !data.cpu ||
    !data.memory ||
    !data.zoneName ||
    !data.backendPort
  ) {
    throw new Error("Missing required ECS parameters");
  }

  const deploymentName = data.zoneName;

  const templatePath = path.join(
    __dirname,
    "../../terraform/templates/ecs"
  );

  const deploymentPath = path.join(
    __dirname,
    `../../terraform/deployments/ecs/${deploymentName}`
  );

  fs.mkdirSync(deploymentPath, { recursive: true });

  fs.cpSync(templatePath, deploymentPath, { recursive: true });

  // -------------------------------
  // Metadata
  // -------------------------------
  const metadata = {
    name: data.zoneName,
    type: "ECS",
    region: data.region,
    account: data.account,
    status: "Creating",
    cloud: "AWS"
  };

  fs.writeFileSync(
    path.join(deploymentPath, "metadata.json"),
    JSON.stringify(metadata, null, 2)
  );

  // -------------------------------
  // Role ARN (FIXED POSITION)
  // -------------------------------
  const roleArn =
    `arn:aws:iam::${data.account}:role/ACPDeploymentRole`;

  // -------------------------------
  // Auto create tfvars
  // -------------------------------
  const tfvars = `
cluster_name = "${data.clusterName}"
region       = "${data.region}"
vpc_id       = "${data.vpcId}"

cpu          = ${data.cpu}
memory       = ${data.memory}

zone_name    = "${data.zoneName}"
created_by   = "ACP-Portal"

role_arn     = "${roleArn}"

# Default values (can override later)
container_port    = ${data.backendPort}
listener_priority = 100
path_patterns     = ["/api/*"]

environment_variables = []
`;

  fs.writeFileSync(
    path.join(deploymentPath, "terraform.tfvars"),
    tfvars
  );

  // -------------------------------
  // Terraform Command
  // -------------------------------
  const command = `
terraform init &&
terraform apply -auto-approve
`;

  let child;

  try {
    child = exec(command, { cwd: deploymentPath });
  } catch (error) {
    console.error("ECS Exec Error:", error);
    throw error;
  }

  child.stdout.on("data", (data) => {
    logs.push(data.toString());
    console.log(data.toString());
  });

  child.stderr.on("data", (data) => {
    logs.push(data.toString());
    console.error(data.toString());
  });

  child.on("close", (code) => {

    const metadataPath = path.join(
      deploymentPath,
      "metadata.json"
    );

    if (fs.existsSync(metadataPath)) {

      const metadata = JSON.parse(
        fs.readFileSync(metadataPath)
      );

      metadata.status =
        code === 0 ? "Active" : "Failed";

      fs.writeFileSync(
        metadataPath,
        JSON.stringify(metadata, null, 2)
      );
    }

    logs.push(
      code === 0
        ? "INFRA_CREATED"
        : "INFRA_FAILED"
    );

  });

};

exports.deployAwsRds = (data) => {

  logs = [];

  // -------------------------------
  // Validate Request
  // -------------------------------
  if (
    !data.accountID ||
    !data.region ||
    !data.rdsIdentifier ||
    !data.dbEngine ||
    !data.username ||
    !data.password ||
    !data.vpcId ||
    !data.zoneName
  ) {
    throw new Error("Missing required RDS parameters");
  }

  const deploymentName = data.zoneName;

  const templatePath = path.join(
    __dirname,
    "../../terraform/templates/rds"
  );

  const deploymentPath = path.join(
    __dirname,
    `../../terraform/deployments/rds/${deploymentName}`
  );

  fs.mkdirSync(deploymentPath, { recursive: true });

  fs.cpSync(templatePath, deploymentPath, { recursive: true });

  // -------------------------------
  // Metadata
  // -------------------------------
  const metadata = {
    name: data.zoneName,
    type: "RDS",
    region: data.region,
    account: data.accountID,
    status: "Creating",
    cloud: "AWS",
    dbUsername: data.username,
    dbPassword: data.password,
    dbName: data.initialDbName || ''
  };

  fs.writeFileSync(
    path.join(deploymentPath, "metadata.json"),
    JSON.stringify(metadata, null, 2)
  );

  // -------------------------------
  // Role ARN
  // -------------------------------
  const roleArn =
    `arn:aws:iam::${data.accountID}:role/ACPDeploymentRole`;

  // -------------------------------
  // Terraform tfvars
  // -------------------------------
  const tfvars = `
region          = "${data.region}"
rds_identifier  = "${data.rdsIdentifier}"
db_engine       = "${data.dbEngine}"

db_username     = "${data.username}"
db_password     = "${data.password}"

vpc_id          = "${data.vpcId}"
subnet_ids      = ${JSON.stringify(data.subnet_ids)}

create_db       = ${data.createInitialDb || false}
initial_db_name = "${data.initialDbName || ""}"

zone_name       = "${data.zoneName}"
role_arn        = "${roleArn}"
`;

  fs.writeFileSync(
    path.join(deploymentPath, "terraform.tfvars"),
    tfvars
  );

  // -------------------------------
  // Terraform Command
  // -------------------------------
  const command = `
terraform init &&
terraform apply -auto-approve
`;

  let child;

  try {
    child = exec(command, { cwd: deploymentPath });
  } catch (error) {
    console.error("RDS Exec Error:", error);
    throw error;
  }

  child.stdout.on("data", (data) => {
    logs.push(data.toString());
    console.log(data.toString());
  });

  child.stderr.on("data", (data) => {
    logs.push(data.toString());
    console.error(data.toString());
  });

  child.on("close", (code) => {

    const metadataPath = path.join(
      deploymentPath,
      "metadata.json"
    );

    if (fs.existsSync(metadataPath)) {

      const metadata = JSON.parse(
        fs.readFileSync(metadataPath)
      );

      metadata.status = code === 0 ? "Active" : "Failed";

      // ADD: capture RDS endpoint from terraform output
      if (code === 0) {
        try {
          const { execSync } = require("child_process");
          const outputs = JSON.parse(
            execSync("terraform output -json", { cwd: deploymentPath }).toString()
          );
          if (outputs.rds_endpoint?.value) {
            const [host, port] = outputs.rds_endpoint.value.split(":");
            metadata.rdsEndpoint = host;
            metadata.rdsPort = port || "5432";
          }
        } catch (e) {
          console.error("Could not capture RDS endpoint:", e.message);
        }
      }

      fs.writeFileSync(
        metadataPath,
        JSON.stringify(metadata, null, 2)
      );
    }

    logs.push(
      code === 0
        ? "INFRA_CREATED"
        : "INFRA_FAILED"
    );

  });

};