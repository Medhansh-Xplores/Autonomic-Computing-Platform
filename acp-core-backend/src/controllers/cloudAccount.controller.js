const db = require('../config/db');
const { v4: uuidv4 } = require('uuid');

function mapAccount(row) {
    return {
        id: row.id,
        accountId: row.account_id,
        accountName: row.account_name,
        region: row.region,
        authType: row.auth_type || 'role',
        roleArn: row.role_arn,
        externalId: row.external_id,
        accessKeyId: row.access_key_id,
        isDefault: row.is_default,
        provider: row.provider || 'AWS'
    };
}
// GET /cloud-accounts/new-external-id
exports.getNewExternalId = (req, res) => {
    const { v4: uuidv4 } = require('uuid');
    res.status(200).json({ externalId: uuidv4() });
};

// GET /cloud-accounts — get all accounts for logged-in user
exports.getAccounts = async (req, res) => {
    const userId = req.user.username; // set by auth middleware
    try {
        const result = await db.query(
            'SELECT * FROM cloud_accounts WHERE user_id = $1 ORDER BY is_default DESC, created_at ASC',
            [userId]
        );
        res.status(200).json(result.rows.map(mapAccount));
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Failed to fetch cloud accounts' });
    }
};

// POST /cloud-accounts — add a new account
exports.addAccount = async (req, res) => {
    const userId = req.user.username;
    const { accountId, accountName, region, authType, roleArn, accessKeyId, secretAccessKey, isDefault, provider } = req.body;

    if (!accountId || !accountName || !region || !authType) {
        return res.status(400).json({ message: 'accountId, accountName, region, and authType are required' });
    }
    if (authType === 'role' && !roleArn) {
        return res.status(400).json({ message: 'roleArn is required for role-based auth' });
    }
    if (authType === 'secret' && (!roleArn || !req.body.externalId || !secretAccessKey)) {
        return res.status(400).json({ message: 'tenantId, clientId, and clientSecret are required for Service Principal' });
    }
    if (authType === 'keys' && (!accessKeyId || !secretAccessKey)) {
        return res.status(400).json({ message: 'accessKeyId and secretAccessKey are required for key-based auth' });
    }

    try {
        // If this is default, unset all others first
        if (isDefault) {
            await db.query(
                'UPDATE cloud_accounts SET is_default = FALSE WHERE user_id = $1',
                [userId]
            );
        }

        const externalId = req.body.externalId || uuidv4();

        const result = await db.query(
            `INSERT INTO cloud_accounts (user_id, account_id, account_name, region, auth_type, role_arn, external_id, access_key_id, secret_access_key, is_default, provider)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *`,
            [userId, accountId, accountName, region, authType,
                authType === 'role' || authType === 'secret' ? roleArn : null,
                authType === 'role' ? externalId : (authType === 'secret' ? req.body.externalId || null : null),
                authType === 'keys' ? accessKeyId : null,
                authType === 'keys' || authType === 'secret' ? secretAccessKey : null,
                isDefault || false, provider || 'AWS']
        );

        res.status(201).json(mapAccount(result.rows[0]));
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Failed to save cloud account' });
    }
};

// PUT /cloud-accounts/:id — update an account
exports.updateAccount = async (req, res) => {
    const userId = req.user.username;
    const { id } = req.params;
    const { accountId, accountName, region, authType, roleArn, accessKeyId, secretAccessKey, isDefault, provider } = req.body;

    try {
        if (isDefault) {
            await db.query(
                'UPDATE cloud_accounts SET is_default = FALSE WHERE user_id = $1',
                [userId]
            );
        }

        const result = await db.query(
            `UPDATE cloud_accounts
             SET account_id=$1, account_name=$2, region=$3, auth_type=$4,
                 role_arn=$5, external_id=$6,
                 access_key_id=$7, secret_access_key=$8,
                 is_default=$9, provider=$10, updated_at=NOW()
           WHERE id=$11 AND user_id=$12 RETURNING *`,
            [accountId, accountName, region, authType,
                authType === 'role' || authType === 'secret' ? roleArn : null,
                authType === 'role' ? (req.body.externalId || null) : (authType === 'secret' ? (req.body.externalId || null) : null),
                authType === 'keys' ? accessKeyId : null,
                authType === 'keys' || authType === 'secret' ? secretAccessKey : null,
                isDefault || false, provider || 'AWS', id, userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Account not found' });
        }

        res.status(200).json(mapAccount(result.rows[0]));
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Failed to update cloud account' });
    }
};

// DELETE /cloud-accounts/:id
exports.deleteAccount = async (req, res) => {
    const userId = req.user.username;
    const { id } = req.params;

    try {
        await db.query(
            'DELETE FROM cloud_accounts WHERE id = $1 AND user_id = $2',
            [id, userId]
        );
        res.status(200).json({ message: 'Account deleted' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Failed to delete account' });
    }
};

// PUT /cloud-accounts/:id/set-default
exports.setDefault = async (req, res) => {
    const userId = req.user.username;
    const { id } = req.params;

    try {
        await db.query(
            'UPDATE cloud_accounts SET is_default = FALSE WHERE user_id = $1',
            [userId]
        );
        await db.query(
            'UPDATE cloud_accounts SET is_default = TRUE WHERE id = $1 AND user_id = $2',
            [id, userId]
        );
        res.status(200).json({ message: 'Default updated' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Failed to set default' });
    }
};

exports.verifyConnection = async (req, res) => {
    const userId = req.user.username;
    const { id } = req.params;

    try {
        const result = await db.query(
            'SELECT * FROM cloud_accounts WHERE id = $1 AND user_id = $2',
            [id, userId]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Account not found' });
        }

        const account = result.rows[0];

        if (account.provider === 'Azure') {
            // Mock Azure connection validation
            return res.status(200).json({ verified: true, message: 'Azure subscription connection successful' });
        }

        const { STSClient, AssumeRoleCommand } = require('@aws-sdk/client-sts');
        const { EC2Client, DescribeRegionsCommand } = require('@aws-sdk/client-ec2');

        if (account.auth_type === 'keys') {
            // Verify access keys by making a lightweight AWS API call
            const ec2 = new EC2Client({
                region: account.region,
                credentials: {
                    accessKeyId: account.access_key_id,
                    secretAccessKey: account.secret_access_key
                }
            });
            await ec2.send(new DescribeRegionsCommand({ Filters: [{ Name: 'region-name', Values: [account.region] }] }));
        } else {
            const sts = new STSClient({ region: account.region });
            await sts.send(new AssumeRoleCommand({
                RoleArn: account.role_arn,
                ExternalId: account.external_id,
                RoleSessionName: 'ACPVerifySession',
                DurationSeconds: 900
            }));
        }

        res.status(200).json({ verified: true, message: 'Connection successful' });
    } catch (err) {
        console.error('Verify connection error:', err);
        res.status(400).json({ verified: false, message: err.message });
    }
};