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
  -var="public_subnet=${data.publicSubnet}" \
  -var="private_subnet=${data.privateSubnet}" \
  -var="region=${data.region}" \
  -var="az=${data.region}a" \
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

  const deploymentsPath = path.join(
    __dirname,
    "../../terraform/deployments/vpc"
  );

  if (!fs.existsSync(deploymentsPath)) {
    return [];
  }

  const folders = fs.readdirSync(deploymentsPath);

  const deployments = folders.map((folder) => {

    const metadataPath = path.join(
      deploymentsPath,
      folder,
      "metadata.json"
    );

    if (!fs.existsSync(metadataPath)) {
      return null;
    }

    return JSON.parse(
      fs.readFileSync(metadataPath, "utf8")
    );

  }).filter(Boolean);

  return deployments;
};

exports.createECS = (data) => {

  logs = [];

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

  const roleArn =
    `arn:aws:iam::${data.account}:role/ACPDeploymentRole`;

  const command = `
terraform init && 
terraform apply -auto-approve \
-var="cluster_name=${data.clusterName}" \
-var="region=${data.region}" \
-var="vpc_id=${data.vpcId}" \
-var="cpu=${data.cpu}" \
-var="memory=${data.memory}" \
-var="zone_name=${data.zoneName}" \
-var="role_arn=${roleArn}"
`;

  const child = exec(command, { cwd: deploymentPath });

  child.stdout.on("data", (data) => {

    logs.push(data.toString());

  });

  child.stderr.on("data", (data) => {

    logs.push(data.toString());

  });

  child.on("close", () => {

    logs.push("INFRA_CREATED");

  });

};