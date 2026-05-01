const terraformService = require("../services/terraform.service");
const { EC2Client, DescribeVpcsCommand } = require("@aws-sdk/client-ec2");
const { STSClient, AssumeRoleCommand } = require("@aws-sdk/client-sts");
const { DescribeSubnetsCommand } = require("@aws-sdk/client-ec2");
const db = require("../config/db");

async function getAccountRow(accountId, userId) {
  const result = await db.query(
    `SELECT auth_type, role_arn, external_id, region,
            access_key_id, secret_access_key
     FROM cloud_accounts WHERE account_id = $1 AND user_id = $2`,
    [accountId, userId]
  );
  if (result.rows.length === 0) throw new Error("No configured cloud account found");
  return result.rows[0];
}

async function resolveCredentials(accountId, userId, region) {
  const account = await getAccountRow(accountId, userId);

  if (account.auth_type === 'keys') {
    // Direct access key path — no STS needed
    return {
      accessKeyId: account.access_key_id,
      secretAccessKey: account.secret_access_key,
      sessionToken: undefined          // no session token for static keys
    };
  }

  // Role-based path — STS AssumeRole
  const sts = new STSClient({ region });
  const assumed = await sts.send(new AssumeRoleCommand({
    RoleArn: account.role_arn,
    ExternalId: account.external_id,
    RoleSessionName: 'acp-deploy'
  }));
  return {
    accessKeyId: assumed.Credentials.AccessKeyId,
    secretAccessKey: assumed.Credentials.SecretAccessKey,
    sessionToken: assumed.Credentials.SessionToken
  };
}

exports.createVPC = async (req, res) => {
  try {
    const data = req.body;
    const userId = req.user?.username;

    const credentials = await resolveCredentials(data.accountID, userId, data.region);
    await terraformService.createVPC(data, credentials);

    res.send({ message: "VPC deployment started" });

  } catch (err) {
    console.error(err);
    res.status(500).send(err);
  }
};


exports.getLogs = (req, res) => {
  try {
    const logs = terraformService.getLogs();
    res.json(logs);
  } catch (err) {
    res.status(500).send(err);
  }
};


exports.getDeployments = async (req, res) => {
  try {
    const deployments = await terraformService.getDeployments();
    res.json(deployments);
  } catch (err) {
    res.status(500).send(err);
  }
};



/* ===============================
   Get VPCs from AWS
================================= */

exports.getVpcs = async (req, res) => {
  try {
    const { accountId, region } = req.query;
    const userId = req.user?.username;

    const credentials = await resolveCredentials(accountId, userId, region);
    const ec2 = new EC2Client({
      region,
      credentials
    });


    const response = await ec2.send(
      new DescribeVpcsCommand({})
    );


    const vpcs = response.Vpcs.map(vpc => {

      const nameTag = vpc.Tags?.find(
        tag => tag.Key === "Name"
      );

      return {
        vpcId: vpc.VpcId,
        cidr: vpc.CidrBlock,
        name: nameTag?.Value || "Unnamed"
      };

    });


    res.json(vpcs);


  } catch (error) {

    console.error(error);

    res.status(500).json({
      error: error.message
    });

  }

};

exports.getSubnets = async (req, res) => {

  try {

    const { accountId, vpcId, region } = req.query;

    if (!accountId || !vpcId || !region) {
      return res.status(400).json({
        error: "accountId, vpcId and region are required"
      });
    }

    const userId = req.user?.username;

    const credentials = await resolveCredentials(accountId, userId, region);

    // ✅ Use assumed credentials
    const ec2 = new EC2Client({
      region,
      credentials
    });

    const response = await ec2.send(
      new DescribeSubnetsCommand({
        Filters: [
          {
            Name: "vpc-id",
            Values: [vpcId]
          }
        ]
      })
    );

    const subnets = response.Subnets.map(subnet => {

      const nameTag = subnet.Tags?.find(
        tag => tag.Key === "Name"
      );

      return {
        subnetId: subnet.SubnetId,
        az: subnet.AvailabilityZone,
        name: nameTag?.Value || "Unnamed"
      };

    });

    res.json(subnets);

  } catch (error) {

    console.error("Subnet fetch error:", error);

    res.status(500).json({
      error: error.message
    });

  }

};

exports.createECS = async (req, res) => {
  try {
    const data = req.body;
    const userId = req.user?.username;

    const credentials = await resolveCredentials(data.accountID, userId, data.region);

    await terraformService.createECS(data, credentials);

    res.send({ message: "ECS deployment started" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};

exports.deployAwsRds = async (req, res) => {

  try {

    const data = req.body;

    const { accountID, region, vpcId } = data;

    // Assume role
    const userId = req.user?.username;

    const credentials = await resolveCredentials(accountID, userId, region);

    const ec2 = new EC2Client({
      region,
      credentials
    });

    const response = await ec2.send(
      new DescribeSubnetsCommand({
        Filters: [
          {
            Name: "vpc-id",
            Values: [vpcId]
          }
        ]
      })
    );

    // Filter PRIVATE subnets only
    const subnetIds = response.Subnets
      .filter(subnet => !subnet.MapPublicIpOnLaunch)
      .map(subnet => subnet.SubnetId);

    data.subnet_ids = subnetIds;

    await terraformService.deployAwsRds(data, credentials);

    res.send({
      message: "RDS deployment started"
    });

  } catch (err) {

    console.error(err);
    res.status(500).send(err);

  }

};

// infra.controller.js
exports.deleteInfra = async (req, res) => {
  const { id } = req.params;
  const userId = req.user?.username;

  try {
    // 1. Fetch the record from DB
    const result = await db.query(
      `SELECT * FROM infra_deployments WHERE id = $1`,
      [id]
    );
    if (!result.rows.length) {
      return res.status(404).json({ error: "Deployment not found" });
    }

    const deployment = result.rows[0];
    const { name, type, region, account } = deployment;

    // 2. Update status to "Deleting" so the UI reflects it
    await db.query(
      `UPDATE infra_deployments SET status = 'Deleting', updated_at = NOW() WHERE id = $1`,
      [id]
    );

    // 3. Resolve AWS credentials for this account
    const credentials = await resolveCredentials(account, userId, region);

    // 4. Run terraform destroy (async — respond immediately, destroy in background)
    res.json({ message: "Destroy started", id });

    try {
      await terraformService.destroyInfra(name, type, credentials, region);

      // 5. Delete RDS record only after successful destroy
      await db.query(`DELETE FROM infra_deployments WHERE id = $1`, [id]);

    } catch (err) {
      console.error("Destroy failed:", err);
      // Mark as failed so user can see it in the UI
      await db.query(
        `UPDATE infra_deployments SET status = 'Delete Failed', updated_at = NOW() WHERE id = $1`,
        [id]
      );
    }

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};