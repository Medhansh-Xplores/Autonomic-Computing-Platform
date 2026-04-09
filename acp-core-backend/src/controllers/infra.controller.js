const terraformService = require("../services/terraform.service");
const { EC2Client, DescribeVpcsCommand } = require("@aws-sdk/client-ec2");
const { STSClient, AssumeRoleCommand } = require("@aws-sdk/client-sts");
const { DescribeSubnetsCommand } = require("@aws-sdk/client-ec2");

exports.createVPC = async (req, res) => {

  try {

    const data = req.body;

    await terraformService.createVPC(data);

    res.send({
      message: "VPC deployment started"
    });

  } catch (err) {
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


exports.getDeployments = (req, res) => {
  try {

    const deployments = terraformService.getDeployments();

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

    if (!accountId || !region) {
      return res.status(400).json({
        error: "accountId and region required"
      });
    }


    // Assume role into target account
    const sts = new STSClient({ region });

    const assumeRole = await sts.send(
      new AssumeRoleCommand({
        RoleArn: `arn:aws:iam::${accountId}:role/ACPDeploymentRole`,
        RoleSessionName: "acp-vpc-list"
      })
    );


    const credentials = {
      accessKeyId: assumeRole.Credentials.AccessKeyId,
      secretAccessKey: assumeRole.Credentials.SecretAccessKey,
      sessionToken: assumeRole.Credentials.SessionToken
    };


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

    const { vpcId, region } = req.query;

    const ec2 = new EC2Client({
      region
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

    await terraformService.createECS(req.body);

    res.send({
      message: "ECS deployment started"
    });

  } catch (err) {

    res.status(500).send(err);

  }

};

exports.deployAwsRds = async (req, res) => {

  try {

    const data = req.body;

    const { accountID, region, vpcId } = data;

    // Assume role
    const sts = new STSClient({ region });

    const assumeRole = await sts.send(
      new AssumeRoleCommand({
        RoleArn: `arn:aws:iam::${accountID}:role/ACPDeploymentRole`,
        RoleSessionName: "acp-rds-subnet"
      })
    );

    const credentials = {
      accessKeyId: assumeRole.Credentials.AccessKeyId,
      secretAccessKey: assumeRole.Credentials.SecretAccessKey,
      sessionToken: assumeRole.Credentials.SessionToken
    };

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

    await terraformService.deployAwsRds(data);

    res.send({
      message: "RDS deployment started"
    });

  } catch (err) {

    console.error(err);
    res.status(500).send(err);

  }

};