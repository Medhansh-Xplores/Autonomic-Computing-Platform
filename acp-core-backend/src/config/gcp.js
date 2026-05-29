// src/config/gcp.js
const fs = require('fs');
const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');

async function loadGcpCredentials() {
    const credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;

    if (credPath && fs.existsSync(credPath)) {
        console.log('GCP: using local credentials file:', credPath);
        return;
    }

    // Use name directly — more reliable than ARN across destroy/apply cycles
    const secretId = process.env.GCP_SA_SECRET_ARN || 'acp/gcp-service-account';

    const client = new SecretsManagerClient({
        region: process.env.COGNITO_REGION || 'us-east-1'
    });

    try {
        const result = await client.send(new GetSecretValueCommand({ SecretId: secretId }));
        const keyPath = '/tmp/gcp-sa-key.json';
        fs.writeFileSync(keyPath, result.SecretString);
        process.env.GOOGLE_APPLICATION_CREDENTIALS = keyPath;
        console.log('GCP: credentials loaded from Secrets Manager →', keyPath);
    } catch (err) {
        console.error('GCP: failed to load credentials:', err.message);
        // Don't crash the server — non-aiops routes should still work
    }
}

module.exports = { loadGcpCredentials };