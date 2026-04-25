const db = require('../config/db');
const { v4: uuidv4 } = require('uuid');

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
        res.status(200).json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Failed to fetch cloud accounts' });
    }
};

// POST /cloud-accounts — add a new account
exports.addAccount = async (req, res) => {
    const userId = req.user.username;
    const { accountId, accountName, region, roleArn, isDefault } = req.body;

    if (!accountId || !accountName || !region || !roleArn) {
        return res.status(400).json({
            message: 'accountId, accountName, region, and roleArn are required'
        });
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
            `INSERT INTO cloud_accounts (user_id, account_id, account_name, region, role_arn, external_id, is_default)
             VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
            [userId, accountId, accountName, region, roleArn, externalId, isDefault || false]
        );

        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Failed to save cloud account' });
    }
};

// PUT /cloud-accounts/:id — update an account
exports.updateAccount = async (req, res) => {
    const userId = req.user.username;
    const { id } = req.params;
    const { accountId, accountName, region, roleArn, isDefault } = req.body;

    try {
        if (isDefault) {
            await db.query(
                'UPDATE cloud_accounts SET is_default = FALSE WHERE user_id = $1',
                [userId]
            );
        }

        const result = await db.query(
            `UPDATE cloud_accounts 
             SET account_id=$1, account_name=$2, region=$3, role_arn=$4, is_default=$5, updated_at=NOW()
             WHERE id=$6 AND user_id=$7 RETURNING *`,
            [accountId, accountName, region, roleArn || null, isDefault || false, id, userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Account not found' });
        }

        res.status(200).json(result.rows[0]);
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
        const { STSClient, AssumeRoleCommand } = require('@aws-sdk/client-sts');
        const sts = new STSClient({ region: account.region });

        await sts.send(new AssumeRoleCommand({
            RoleArn: account.role_arn,
            ExternalId: account.external_id,
            RoleSessionName: 'ACPVerifySession',
            DurationSeconds: 900
        }));

        res.status(200).json({ verified: true, message: 'Connection successful' });
    } catch (err) {
        console.error('Verify connection error:', err);
        res.status(400).json({ verified: false, message: err.message });
    }
};