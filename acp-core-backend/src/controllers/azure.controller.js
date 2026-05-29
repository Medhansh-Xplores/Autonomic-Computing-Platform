const db = require('../config/db');
const axios = require('axios');

/* ===================================================
   Helper: Resolve Azure credentials from DB
   =================================================== */
async function resolveAzureCredentials(accountId, userId) {
    const result = await db.query(
        `SELECT account_id, role_arn, external_id, secret_access_key
         FROM cloud_accounts
         WHERE (account_id = $1 OR id::text = $1) AND user_id = $2 AND LOWER(provider) = 'azure'
         LIMIT 1`,
        [accountId, userId]
    );
    if (result.rows.length === 0) throw new Error('No configured Azure cloud account found');
    const account = result.rows[0];
    return {
        subscription_id: account.account_id,
        tenant_id: account.role_arn,
        client_id: account.external_id,
        client_secret: account.secret_access_key
    };
}

async function getAzureToken(creds) {
    const resp = await axios.post(
        `https://login.microsoftonline.com/${creds.tenant_id}/oauth2/v2.0/token`,
        new URLSearchParams({
            client_id: creds.client_id,
            client_secret: creds.client_secret,
            grant_type: 'client_credentials',
            scope: 'https://management.azure.com/.default'
        }),
        { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );
    return resp.data.access_token;
}

/* ===================================================
   GET /azure/accounts
   Returns all Azure cloud accounts for the user
   =================================================== */
exports.getAzureAccounts = async (req, res) => {
    const userId = req.user?.username;
    try {
        const result = await db.query(
            `SELECT account_id AS "accountId", account_name AS "accountName"
             FROM cloud_accounts
             WHERE user_id = $1 AND LOWER(provider) = 'azure'
             ORDER BY is_default DESC, created_at ASC`,
            [userId]
        );
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to fetch Azure accounts' });
    }
};

/* ===================================================
   GET /azure/regions
   Returns curated list of Azure regions (static)
   =================================================== */
exports.getAzureRegions = async (req, res) => {
    res.json([
        'eastus',
        'eastus2',
        'centralus',
        'westus',
        'westus2',
        'westus3',
        'northcentralus',
        'southcentralus',
        'westcentralus',
        'northeurope',
        'westeurope',
        'uksouth',
        'ukwest',
        'francecentral',
        'germanywestcentral',
        'swedencentral',
        'switzerlandnorth',
        'norwayeast',
        'southeastasia',
        'eastasia',
        'japaneast',
        'japanwest',
        'australiaeast',
        'australiasoutheast',
        'centralindia',
        'southindia',
        'westindia',
        'canadacentral',
        'canadaeast',
        'brazilsouth',
        'southafricanorth',
        'uaenorth'
    ]);
};

/* ===================================================
   GET /azure/container-app-environments?account=X&region=Y
   Lists existing Container App Environments (like ECS clusters)
   =================================================== */
exports.getContainerAppEnvironments = async (req, res) => {
    const { account, region } = req.query;
    const userId = req.user?.username;
    try {
        const creds = await resolveAzureCredentials(account, userId);
        const token = await getAzureToken(creds);

        const url = `https://management.azure.com/subscriptions/${creds.subscription_id}/providers/Microsoft.App/managedEnvironments?api-version=2023-05-01`;
        const resp = await axios.get(url, { headers: { Authorization: `Bearer ${token}` } });

        let envs = (resp.data.value || [])
            .filter(e => !region || e.location === region || e.location === region.replace(/\s/g, '').toLowerCase())
            .map(e => ({ name: e.name, resourceGroup: e.id.split('/')[4], location: e.location }));

        if (envs.length === 0) {
            envs = [
                { name: 'acp-containerapp-env', resourceGroup: 'acp-rg', location: region || 'eastus' }
            ];
        }

        res.json(envs);
    } catch (err) {
        console.error('Failed to list Container App Environments:', err.response?.data || err.message);
        res.status(500).json({ error: 'Failed to fetch Container App Environments' });
    }
};

/* ===================================================
   GET /azure/aks-clusters?account=X&region=Y
   Lists existing AKS clusters (like ECS clusters)
   =================================================== */
exports.getAksClusters = async (req, res) => {
    const { account, region } = req.query;
    const userId = req.user?.username;
    try {
        const creds = await resolveAzureCredentials(account, userId);
        const token = await getAzureToken(creds);

        const url = `https://management.azure.com/subscriptions/${creds.subscription_id}/providers/Microsoft.ContainerService/managedClusters?api-version=2024-01-01`;
        const resp = await axios.get(url, { headers: { Authorization: `Bearer ${token}` } });

        let clusters = (resp.data.value || [])
            .filter(c => !region || c.location === region || c.location === region.replace(/\s/g, '').toLowerCase())
            .map(c => ({ name: c.name, resourceGroup: c.id.split('/')[4], location: c.location }));

        if (clusters.length === 0) {
            clusters = [
                { name: 'acp-aks-cluster', resourceGroup: 'acp-rg', location: region || 'eastus' }
            ];
        }

        res.json(clusters);
    } catch (err) {
        console.error('Failed to list AKS clusters:', err.response?.data || err.message);
        res.status(500).json({ error: 'Failed to fetch AKS clusters' });
    }
};

/* ===================================================
   GET /azure/app-service-plans?account=X&region=Y
   Lists existing App Service Plans (like EC2 instances)
   =================================================== */
exports.getAppServicePlans = async (req, res) => {
    const { account, region } = req.query;
    const userId = req.user?.username;
    try {
        const creds = await resolveAzureCredentials(account, userId);
        const token = await getAzureToken(creds);

        const url = `https://management.azure.com/subscriptions/${creds.subscription_id}/providers/Microsoft.Web/serverFarms?api-version=2022-03-01`;
        const resp = await axios.get(url, { headers: { Authorization: `Bearer ${token}` } });

        let plans = (resp.data.value || [])
            .filter(p => !region || p.location === region || p.location.toLowerCase().replace(/\s/g, '') === region.toLowerCase())
            .map(p => ({ name: p.name, resourceGroup: p.id.split('/')[4], location: p.location, sku: p.sku?.name }));

        if (plans.length === 0) {
            plans = [
                { name: 'acp-appservice-plan', resourceGroup: 'acp-rg', location: region || 'eastus', sku: 'Standard-S1' }
            ];
        }

        res.json(plans);
    } catch (err) {
        console.error('Failed to list App Service Plans:', err.response?.data || err.message);
        res.status(500).json({ error: 'Failed to fetch App Service Plans' });
    }
};
