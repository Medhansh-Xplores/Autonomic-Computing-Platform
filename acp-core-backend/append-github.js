const fs = require('fs');
const code = `
exports.deployToAzureAppService = async (req, res) => {
    try {
        const {
            repoUrl, branch, token,
            frontendPath, backendPath,
            account,                    // Azure account id (subscription id)
            acrName,
            appName,
            appServiceName,
            region,
            port
        } = req.body;

        if (!repoUrl || !appName || !account || !region) {
            return res.status(400).json({ message: 'repoUrl, appName, account and region are required' });
        }

        const safeAppName = (appName || 'app')
            .toLowerCase()
            .replace(/\\s+/g, '-')
            .replace(/[^a-z0-9-]/g, '');

        const resolvedAppServiceName = appServiceName || safeAppName;
        const resourceGroupName = \`rg-\${resolvedAppServiceName}\`;
        const generatedAcrName = acrName
            ? acrName.toLowerCase().replace(/[^a-z0-9]/g, '')
            : \`acr\${safeAppName.replace(/-/g, '')}\`;  // ACR names: alphanumeric only

        // Clear any stale pending entry
        pendingDeployments.delete(appName);

        // Respond immediately so the frontend can navigate to the log page
        res.json({ provisioning: true });

        // Run Terraform and deployment in background
        try {
            const infraController = require('./infra.controller');
            const creds = await infraController.resolveAzureCredentials(account, req.user?.username);

            if (!creds) {
                throw new Error("Azure credentials not found for this account");
            }

            // STEP 1: Provision Infrastructure via Terraform (Background)
            console.log(\`Starting background Terraform provisioning for Azure App Service: \${resolvedAppServiceName}\`);
            const terraformService = require('../services/terraform.service');
            await terraformService.createAzureAppService({
                accountID: account,
                region,
                appServiceName: resolvedAppServiceName,
                acrName: generatedAcrName,
                port: port || 80,
                zoneName: "internal.acp"
            }, creds, req.user?.username);

            // Wait briefly for outputs to be written
            await new Promise(r => setTimeout(r, 2000));

            // Load Terraform outputs
            const infraMetadata = await require('../services/deployments.service').getInfraMetadata(resolvedAppServiceName);
            if (!infraMetadata || !infraMetadata.outputs) {
                throw new Error("Failed to load Terraform outputs for Azure App Service");
            }
            const tfOutputs = infraMetadata.outputs;

            // STEP 2: Generate workflow YAML
            const workflowYaml = generateAzureAppServiceWorkflowYaml({
                appServiceName: resolvedAppServiceName,
                acrName: generatedAcrName,
                resourceGroupName
            }, appName);

            // STEP 3: Commit YAML to Repository
            const workflowName = \`deploy-\${safeAppName}-app-service.yml\`;
            const githubService = require('../services/github.service');
            await githubService.commitFile(
                repoUrl,
                \`.github/workflows/\${workflowName}\`,
                workflowYaml,
                \`Add ACP Azure App Service Deployment Workflow for \${appName}\`,
                branch,
                token
            );

            // Wait a moment for GitHub to index the workflow file
            console.log("Waiting 30s for GitHub to index the new workflow...");
            await new Promise(r => setTimeout(r, 30000));

            // STEP 4: Trigger the workflow
            const runId = await githubService.triggerWorkflow(
                repoUrl,
                workflowName,
                branch,
                token,
                {
                    azure_region: region,
                    acr_name: generatedAcrName,
                    resource_group: resourceGroupName,
                    app_service_name: resolvedAppServiceName,
                    backend_path: backendPath || "backend",
                    frontend_path: frontendPath || "frontend",
                    port: (port || "80").toString()
                }
            );

            if (!runId) {
                throw new Error("GitHub workflow triggered but runId could not be resolved. Try again.");
            }

            // STEP 5: Save deployment record
            const deploymentModel = require('../models/deployment.model');
            const repoParts = repoUrl
                .replace(/\\.git$/, '')
                .replace(/^https?:\\/\\/github\\.com\\//, '')
                .replace(/\\/+$/, '')
                .split('/');

            const { id: deploymentId } = await deploymentModel.createDeployment({
                name: appName,
                cloud: 'Azure',
                deployment: 'App Service',
                repoUrl,
                repoName: repoParts[1] || '',
                account: repoParts[0] || account,
                accountID: account,
                userId: req.user?.username,
                workflow: workflowName,
                branch,
                region,
                runId,
                status: 'running',
                triggeredFrom: 'ACP Portal',
                createdAt: new Date().toISOString()
            });

            // STEP 6: Store for frontend polling
            pendingDeployments.set(appName, { runId, deploymentId });
            console.log(\`Azure App Service deployment ready: appName=\${appName} runId=\${runId} deploymentId=\${deploymentId}\`);

        } catch (bgError) {
            const errorMsg = bgError.response?.data?.message || bgError.message;
            console.error('Azure App Service background deploy error:', errorMsg);
            pendingDeployments.set(appName, { error: errorMsg });
        }

    } catch (error) {
        console.error('Azure App Service deploy error:', error.message);
        if (!res.headersSent) {
            res.status(500).json({ message: 'Azure App Service deployment failed', error: error.message });
        }
    }
};

function generateAzureAppServiceWorkflowYaml(cfg, appName) {
    return \`name: Deploy \${appName} to Azure App Service

on:
  workflow_dispatch:
    inputs:
      azure_region:
        required: true
        type: string
      acr_name:
        required: true
        type: string
      resource_group:
        required: true
        type: string
      app_service_name:
        required: true
        type: string
      frontend_path:
        required: true
        default: "frontend"
        type: string
      backend_path:
        required: true
        default: "backend"
        type: string
      port:
        required: true
        default: "80"
        type: string

env:
  IMAGE_TAG: \\\${{ github.sha }}

jobs:
  build-and-deploy:
    name: Build, push and deploy to Azure App Service
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Azure Login
        uses: azure/login@v2
        with:
          creds: |
            {
              "clientId": "\\\${{ secrets.AZURE_CLIENT_ID }}",
              "clientSecret": "\\\${{ secrets.AZURE_CLIENT_SECRET }}",
              "tenantId": "\\\${{ secrets.AZURE_TENANT_ID }}",
              "subscriptionId": "\\\${{ secrets.AZURE_SUBSCRIPTION_ID }}"
            }

      - name: Log in to ACR
        run: az acr login --name \\\${{ inputs.acr_name }}

      - name: Build and push backend image
        run: |
          docker build -t \\\${{ inputs.acr_name }}.azurecr.io/\\\${{ inputs.app_service_name }}-backend:\\\${{ env.IMAGE_TAG }} -f \\\${{ inputs.backend_path }}/Dockerfile \\\${{ inputs.backend_path }}
          docker push \\\${{ inputs.acr_name }}.azurecr.io/\\\${{ inputs.app_service_name }}-backend:\\\${{ env.IMAGE_TAG }}

      - name: Deploy to Azure App Service
        uses: azure/webapps-deploy@v2
        with:
          app-name: \\\${{ inputs.app_service_name }}
          images: \\\${{ inputs.acr_name }}.azurecr.io/\\\${{ inputs.app_service_name }}-backend:\\\${{ env.IMAGE_TAG }}
\`;
}
`;

fs.appendFileSync('src/controllers/github.controller.js', code);
