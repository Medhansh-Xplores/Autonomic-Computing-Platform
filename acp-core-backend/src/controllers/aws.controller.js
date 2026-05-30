const { EC2Client, DescribeRegionsCommand } = require('@aws-sdk/client-ec2');
const { ECSClient, ListClustersCommand } = require('@aws-sdk/client-ecs');
const { RDSClient, DescribeDBInstancesCommand } = require('@aws-sdk/client-rds');
const { STSClient, AssumeRoleCommand } = require('@aws-sdk/client-sts');
const db = require('../config/db');

// ── same resolveCredentials helper as infra.controller.js ──
async function resolveCredentials(accountId, userId, region) {
    const result = await db.query(
        `SELECT auth_type, role_arn, external_id, access_key_id, secret_access_key
     FROM cloud_accounts WHERE account_id = $1 AND user_id = $2`,
        [accountId, userId]
    );
    if (!result.rows.length) throw new Error('Cloud account not found');
    const account = result.rows[0];

    if (account.auth_type === 'keys') {
        return { accessKeyId: account.access_key_id, secretAccessKey: account.secret_access_key };
    }

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

// GET /api/v1/aws/accounts
exports.getAwsAccounts = async (req, res) => {
    const userId = req.user?.username;
    try {
        const result = await db.query(
            `SELECT account_id AS "accountID", account_name AS "accountName"
       FROM cloud_accounts WHERE user_id = $1 ORDER BY is_default DESC, created_at ASC`,
            [userId]
        );
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to fetch accounts' });
    }
};

// GET /api/v1/aws/regions?account=X&region=Y
exports.getAwsRegions = async (req, res) => {
    const { account, region = 'us-east-1' } = req.query;
    const userId = req.user?.username;
    try {
        const credentials = await resolveCredentials(account, userId, region);
        const ec2 = new EC2Client({ region, credentials });
        const response = await ec2.send(new DescribeRegionsCommand({}));
        res.json(response.Regions.map(r => r.RegionName));
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to fetch regions' });
    }
};

// GET /api/v1/aws/ecs-clusters?account=X&region=Y
exports.getAwsEcsClusters = async (req, res) => {
    const { account, region } = req.query;
    const userId = req.user?.username;
    try {
        const credentials = await resolveCredentials(account, userId, region);
        const ecs = new ECSClient({ region, credentials });
        const response = await ecs.send(new ListClustersCommand({}));
        res.json(response.clusterArns.map(arn => arn.split('/').pop()));
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to fetch ECS clusters' });
    }
};

// GET /api/v1/aws/rds-instances?account=X&region=Y
exports.getAwsRdsInstances = async (req, res) => {
    const { account, region } = req.query;
    const userId = req.user?.username;
    try {
        const credentials = await resolveCredentials(account, userId, region);
        const rds = new RDSClient({ region, credentials });
        const response = await rds.send(new DescribeDBInstancesCommand({}));
        res.json(response.DBInstances.map(db => db.DBInstanceIdentifier));
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to fetch RDS instances' });
    }
};
const { EC2Client, DescribeRegionsCommand } = require('@aws-sdk/client-ec2');
const { ECSClient, ListClustersCommand } = require('@aws-sdk/client-ecs');
const { RDSClient, DescribeDBInstancesCommand } = require('@aws-sdk/client-rds');
const { STSClient, AssumeRoleCommand } = require('@aws-sdk/client-sts');
const db = require('../config/db');

// ── same resolveCredentials helper as infra.controller.js ──
async function resolveCredentials(accountId, userId, region) {
    const result = await db.query(
        `SELECT auth_type, role_arn, external_id, access_key_id, secret_access_key
     FROM cloud_accounts WHERE account_id = $1 AND user_id = $2`,
        [accountId, userId]
    );
    if (!result.rows.length) throw new Error('Cloud account not found');
    const account = result.rows[0];

    if (account.auth_type === 'keys') {
        return { accessKeyId: account.access_key_id, secretAccessKey: account.secret_access_key };
    }

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

// GET /api/v1/aws/accounts
exports.getAwsAccounts = async (req, res) => {
    const userId = req.user?.username;
    try {
        const result = await db.query(
            `SELECT account_id AS "accountID", account_name AS "accountName"
       FROM cloud_accounts WHERE user_id = $1 ORDER BY is_default DESC, created_at ASC`,
            [userId]
        );
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to fetch accounts' });
    }
};

// GET /api/v1/aws/regions?account=X&region=Y
exports.getAwsRegions = async (req, res) => {
    const { account, region = 'us-east-1' } = req.query;
    const userId = req.user?.username;
    try {
        const credentials = await resolveCredentials(account, userId, region);
        const ec2 = new EC2Client({ region, credentials });
        const response = await ec2.send(new DescribeRegionsCommand({}));
        res.json(response.Regions.map(r => r.RegionName));
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to fetch regions' });
    }
};

// GET /api/v1/aws/ecs-clusters?account=X&region=Y
exports.getAwsEcsClusters = async (req, res) => {
    const { account, region } = req.query;
    const userId = req.user?.username;
    try {
        const credentials = await resolveCredentials(account, userId, region);
        const ecs = new ECSClient({ region, credentials });
        const response = await ecs.send(new ListClustersCommand({}));
        res.json(response.clusterArns.map(arn => arn.split('/').pop()));
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to fetch ECS clusters' });
    }
};

// GET /api/v1/aws/rds-instances?account=X&region=Y
exports.getAwsRdsInstances = async (req, res) => {
    const { account, region } = req.query;
    const userId = req.user?.username;
    try {
        const credentials = await resolveCredentials(account, userId, region);
        const rds = new RDSClient({ region, credentials });
        const response = await rds.send(new DescribeDBInstancesCommand({}));
        res.json(response.DBInstances.map(db => db.DBInstanceIdentifier));
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to fetch RDS instances' });
    }
};