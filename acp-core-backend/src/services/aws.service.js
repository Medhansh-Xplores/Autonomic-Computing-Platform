const { STSClient, AssumeRoleCommand } = require("@aws-sdk/client-sts");
const { EC2Client, DescribeRegionsCommand, AuthorizeSecurityGroupIngressCommand } = require("@aws-sdk/client-ec2");
const { ECSClient, ListClustersCommand, ListServicesCommand, DescribeServicesCommand } = require('@aws-sdk/client-ecs');
const { RDSClient, DescribeDBInstancesCommand } = require("@aws-sdk/client-rds");


// Assume role helper
async function assumeRole(roleArn, externalId, region = "us-east-1") {
    const sts = new STSClient({ region });
    const command = new AssumeRoleCommand({
        RoleArn: roleArn,
        ExternalId: externalId,
        RoleSessionName: "ACPDeploySession",
        DurationSeconds: 3600
    });
    const response = await sts.send(command);
    return {
        accessKeyId: response.Credentials.AccessKeyId,
        secretAccessKey: response.Credentials.SecretAccessKey,
        sessionToken: response.Credentials.SessionToken
    };
}


// Get Regions
exports.getAwsRegions = async (roleArn, externalId, region) => {

    const credentials = await assumeRole(roleArn, externalId, region);

    const ec2 = new EC2Client({
        region,
        credentials
    });

    const command = new DescribeRegionsCommand({});

    const response = await ec2.send(command);

    return response.Regions.map(r => r.RegionName);

};


// Get ECS Clusters
exports.getAwsEcsClusters = async (roleArn, externalId, region) => {

    const credentials = await assumeRole(roleArn, externalId, region);

    const ecs = new ECSClient({
        region,
        credentials
    });

    const command = new ListClustersCommand({});

    const response = await ecs.send(command);

    return response.clusterArns.map(arn => arn.split("/").pop());

};

// Get RDS Instances
exports.getAwsRdsInstances = async (roleArn, externalId, region) => {

    const credentials = await assumeRole(roleArn, externalId, region);

    const rds = new RDSClient({
        region,
        credentials
    });

    const command = new DescribeDBInstancesCommand({});

    const response = await rds.send(command);

    return response.DBInstances.map(db => db.DBInstanceIdentifier);

};

exports.getRdsDetails = async (roleArn, externalId, region, rdsIdentifier) => {

    const credentials = await assumeRole(roleArn, externalId, region);
    const rds = new RDSClient({ region, credentials });
    const response = await rds.send(
        new DescribeDBInstancesCommand({ DBInstanceIdentifier: rdsIdentifier })
    );
    const db = response.DBInstances[0];
    return {
        host: db.Endpoint.Address,
        port: String(db.Endpoint.Port),
        dbName: db.DBName || '',
        username: db.MasterUsername
    };
};

exports.connectEcsToRds = async function ({
    roleArn,
    externalId,
    region,
    ecsCluster,
    rdsInstance
}) {

    const credentials = await assumeRole(roleArn, externalId, region);

    const ecs = new ECSClient({ region, credentials });
    const rds = new RDSClient({ region, credentials });
    const ec2 = new EC2Client({ region, credentials });
    // 1. Get ECS Service
    const services = await ecs.send(
        new ListServicesCommand({
            cluster: ecsCluster
        })
    );
    const serviceName = services.serviceArns[0].split('/').pop();

    const service = await ecs.send(
        new DescribeServicesCommand({
            cluster: ecsCluster,
            services: [serviceName]
        })
    );

    const ecsSecurityGroup =
        service.services[0]
            .networkConfiguration
            .awsvpcConfiguration
            .securityGroups[0];

    // 2. Get RDS Security Group
    const db = await rds.send(
        new DescribeDBInstancesCommand({
            DBInstanceIdentifier: rdsInstance
        })
    );

    const rdsSecurityGroup =
        db.DBInstances[0]
            .VpcSecurityGroups[0]
            .VpcSecurityGroupId;

    const port =
        db.DBInstances[0]
            .Endpoint
            .Port;

    // 3. Connect ECS → RDS
    try {
        await ec2.send(
            new AuthorizeSecurityGroupIngressCommand({
                GroupId: rdsSecurityGroup,
                IpPermissions: [
                    {
                        IpProtocol: "tcp",
                        FromPort: port,
                        ToPort: port,
                        UserIdGroupPairs: [
                            {
                                GroupId: ecsSecurityGroup
                            }
                        ]
                    }
                ]
            })
        );


        console.log("ECS connected to RDS");

    } catch (err) {

        if (err.name !== "InvalidPermission.Duplicate") {
            throw err;
        }

        console.log("Connection already exists");
    }
};