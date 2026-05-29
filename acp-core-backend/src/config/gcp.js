// src/config/gcp.js
const fs = require('fs');
const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');

async function loadGcpCredentials() {
    const credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;

    // LOCAL: .env points to a real file on disk → use it as-is
    if (credPath && fs.existsSync(credPath)) {
        console.log('GCP: using local credentials file:', credPath);
        return;
    }

    // ECS: pull the JSON key from Secrets Manager, write to /tmp
    const secretArn = process.env.GCP_SA_SECRET_ARN;
    if (!secretArn) {
        console.warn('GCP: no credentials configured (AI Ops features will not work)');
        return;
    }

    const client = new SecretsManagerClient({
        region: process.env.COGNITO_REGION || 'us-east-1'
    });

    const result = await client.send(new GetSecretValueCommand({ SecretId: secretArn }));

    const keyPath = '/tmp/gcp-sa-key.json';
    fs.writeFileSync(keyPath, result.SecretString);
    process.env.GOOGLE_APPLICATION_CREDENTIALS = keyPath;
    console.log('GCP: credentials loaded from Secrets Manager →', keyPath);
}

module.exports = { loadGcpCredentials };