const githubService = require('../services/github.service');
const axios = require("axios");
const { connectEcsToRds } = require('../services/aws.service');
const terraformService = require('../services/terraform.service');
const {
    ElasticLoadBalancingV2Client,
    ModifyTargetGroupCommand,
    CreateRuleCommand,
    DescribeListenersCommand,
    DescribeTargetGroupsCommand,
    DescribeRulesCommand
} = require("@aws-sdk/client-elastic-load-balancing-v2");
const { STSClient, AssumeRoleCommand } = require("@aws-sdk/client-sts");

exports.getWorkflows = async (req, res) => {
    try {
        const workflows = await githubService.getWorkflows(req.body);
        res.json(workflows);
    } catch (error) {
        console.error(error);
        res.status(500).json({
            message: 'Failed to fetch workflows'
        });
    }
};

exports.triggerWorkflow = async (req, res) => {
    try {

        const response = await githubService.triggerWorkflow(req.body);

        res.json(response);

    } catch (error) {

        console.error(error);

        res.status(500).json({
            message: 'Failed to trigger workflow'
        });

    }
};

exports.getLogs = async (req, res) => {
    try {
        const token = req.query.token || "";
        const repoUrl = req.query.repoUrl || "";
        const workflow = req.query.workflow; // optional if runId provided
        const branch = req.query.branch || "main";
        const runId = req.query.runId; // <-- new

        if (!repoUrl) {
            return res.status(400).json({ error: "repoUrl is required" });
        }
        if (!runId && !workflow) {
            return res.status(400).json({ error: "runId or workflow is required" });
        }

        // Normalize repoUrl -> owner/repo
        const cleaned = repoUrl
            .replace(/\.git$/, "")
            .replace(/^https?:\/\/github\.com\//, "")
            .replace(/\/+$/, "");
        const [owner, repo] = cleaned.split("/");

        if (!owner || !repo) {
            return res.status(400).json({ error: "Invalid repoUrl format" });
        }

        const headers = {
            Accept: 'application/vnd.github+json',
            ...(token ? { Authorization: `Bearer ${token}` } : {})
        };

        // Get the correct run
        let run = null;

        // AFTER
        if (runId) {
            try {
                const runResp = await axios.get(
                    `https://api.github.com/repos/${owner}/${repo}/actions/runs/${runId}`,
                    { headers }
                );
                run = runResp.data;
            } catch (err) {
                // Transient GitHub API error — do NOT mark as failed.
                // Return incomplete so the frontend keeps polling.
                console.warn('[getLogs] transient error fetching run, will retry:', err.message);
                return res.json({ complete: false, failed: false, steps: [] });
            }
        } else {
            const runsResp = await axios.get(
                `https://api.github.com/repos/${owner}/${repo}/actions/workflows/${workflow}/runs?branch=${encodeURIComponent(branch)}&event=workflow_dispatch&per_page=1`,
                { headers }
            );
            run = runsResp.data.workflow_runs?.[0] || null;
        }

        if (!run) {
            return res.json({ steps: [], complete: false, failed: false, url: null });
        }

        // Jobs => steps (for step cards)
        const jobs = await axios.get(run.jobs_url, { headers });

        const steps = [];
        for (const job of jobs.data.jobs || []) {
            for (const step of job.steps || []) {
                steps.push({
                    name: step.name,
                    status: step.status,
                    conclusion: step.conclusion
                });
            }
        }

        const complete = run.status === "completed";
        const failed = complete && run.conclusion !== "success";

        let url = null;

        // Only download & parse Terraform outputs when completed
        if (complete) {
            const logsZipResp = await axios.get(
                `https://api.github.com/repos/${owner}/${repo}/actions/runs/${run.id}/logs`,
                {
                    headers,
                    responseType: 'arraybuffer'
                }
            );

            const AdmZip = require('adm-zip');
            const zip = new AdmZip(logsZipResp.data);
            const fullText = zip.getEntries()
                .map(e => e.getData().toString())
                .join("\n");

            // Example pattern you said exists:
            // frontend_url -= https://...
            const m = fullText.match(/frontend_url\s*[-=]+\s*"?\s*(https?:\/\/[^\s"'<>\)]+)/i);
            url = m ? m[1] : null;
        }

        res.json({
            steps,
            complete,
            failed,
            url,
            runId: run.id
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to fetch logs" });
    }
};

// ─── NEW CONTROLLER ───────────────────────────────────────────────────────────
// ─── TOP OF FILE (module-level) ───────────────────────────────────────────────
// In-memory store: appName -> { runId, deploymentId } or { error }
const pendingDeployments = new Map();

exports.getTerraformLogs = (req, res) => {
    const terraformService = require('../services/terraform.service');
    const logs = terraformService.getLogs();
    const done = logs.includes('INFRA_CREATED') || logs.includes('INFRA_FAILED');
    const failed = logs.includes('INFRA_FAILED');
    res.json({ logs, done, failed });
};

exports.getPendingDeployment = (req, res) => {
    const entry = pendingDeployments.get(req.query.appName);
    if (!entry) return res.json({ ready: false });
    res.json({ ready: true, ...entry });
};

exports.deployToEcs = async (req, res) => {
    try {
        const {
            repoUrl, branch, token,
            frontendPath, backendPath,
            account, region, ecsCluster,
            rdsInstance = req.body.rdsName,   // frontend sends as rdsName
            appName,
            awsAccessKeyId, awsSecretAccessKey, frontendBasePath
        } = req.body;

        const backendPort = req.body.backendPort || '4000';

        console.log("Deploy ECS payload:", {
            repoUrl, branch, frontendPath, backendPath,
            account, region, ecsCluster, rdsInstance, appName
        });

        const terraformService = require('../services/terraform.service');
        const { execSync } = require('child_process');
        const path = require('path');
        const fs = require('fs');

        // ── Read ECS cluster outputs (fast/sync, fine before responding) ─────────────
        const ecsDeployPath = path.join(__dirname, `../../terraform/deployments/ecs/${ecsCluster}`);
        let clusterOutputs = {};
        try {
            const raw = execSync('terraform output -json', { cwd: ecsDeployPath }).toString();
            clusterOutputs = JSON.parse(raw);
        } catch (e) {
            return res.status(500).json({
                message: 'Could not read ECS cluster outputs. Has the ECS cluster been created?',
                error: e.message
            });
        }
        console.log("CLUSTER OUTPUTS:", clusterOutputs);

        const ecsMetaPath = path.join(__dirname, `../../terraform/deployments/ecs/${ecsCluster}/metadata.json`);
        const ecsMeta = JSON.parse(fs.readFileSync(ecsMetaPath));
        const vpcId = ecsMeta.vpcId;

        // ── Derive names (same as before, nothing changed here) ───────────────────────
        const ecsServiceFrontend = `${appName}-frontend`;
        const ecsServiceBackend = `${appName}-backend`;
        const ecsTaskDefFrontend = `${appName}-frontend`;
        const ecsTaskDefBackend = `${appName}-backend`;
        const ecrRepoFrontend = `${appName}-frontend`;
        const ecrRepoBackend = `${appName}-backend`;
        const containerNameFrontend = 'frontend';
        const containerNameBackend = 'backend';
        const ecrRegistry = `${account}.dkr.ecr.${region}.amazonaws.com`;

        // ── Clear any stale entry for this appName ────────────────────────────────────
        pendingDeployments.delete(appName);

        // ── Respond immediately → frontend navigates to log page and starts polling ───
        res.json({ provisioning: true });

        // ── Everything below is the background job ────────────────────────────────────
        // The order is IDENTICAL to the original, just now properly awaited after Terraform
        try {

            const safeAppName = (appName || 'app')
                .toLowerCase()
                .replace(/\s+/g, '-')
                .replace(/[^a-z0-9-]/g, '');

            const infraController = require('../controllers/infra.controller');
            const appCredentials = await infraController.resolveCredentialsPublic(
                account, req.user?.username, region
            );
            // STEP 1: Terraform (the slow part - frontend polls /github/terraform-logs)
            await terraformService.createECSApp({
                account,
                region,
                appName: appName || ecsCluster,
                zoneName: ecsCluster,
                vpcId,
                clusterId: clusterOutputs.cluster_id?.value,
                executionRoleArn: clusterOutputs.execution_role_arn?.value,
                logGroupName: clusterOutputs.log_group_name?.value,
                httpListenerArn: clusterOutputs.http_listener_arn?.value,
                securityGroupId: clusterOutputs.security_group_id?.value,
                privateSubnetIds: clusterOutputs.private_subnet_ids?.value,
                cpu: req.body.cpu || 256,
                memory: req.body.memory || 512,
                containerPort: req.body.backendPort || 3000,
                listenerPriority: req.body.priority || 100,
                pathPatterns: [req.body.apiPath || '/api/*'],
                frontendListenerPriority: (req.body.priority || 100) + 1,
                frontendPathPatterns: frontendBasePath
                    ? [`/${frontendBasePath.replace(/^\/+/, '')}`, `/${frontendBasePath.replace(/^\/+/, '')}/*`]
                    : ['/*'],
            }, appCredentials);
            // ✅ Terraform done — ECR repos, task defs, ECS services now exist

            // STEP 2: Generate and commit workflow YAML (same as before)
            const workflowContent = generateEcsWorkflowYaml({
                region, ecrRegistry,
                ecrRepoFrontend, ecrRepoBackend,
                ecsCluster,
                ecsServiceFrontend, ecsServiceBackend,
                ecsTaskDefFrontend, ecsTaskDefBackend,
                containerNameFrontend, containerNameBackend,
                frontendPath: frontendPath || 'frontend',
                backendPath: backendPath || 'backend',
                backendPort: req.body.backendPort || '3000'
            }, appName);

            await githubService.commitWorkflowFile({
                repoUrl,
                branch,
                token,
                workflowContent,
                appName
            });

            // STEP 3: Assume role and set AWS secrets (same as before)
            const creds = {
                AccessKeyId: appCredentials.accessKeyId,
                SecretAccessKey: appCredentials.secretAccessKey,
                SessionToken: appCredentials.sessionToken
            };

            await githubService.setRepoSecret({ repoUrl, token, secretName: 'AWS_ACCESS_KEY_ID', secretValue: creds.AccessKeyId });
            await githubService.setRepoSecret({ repoUrl, token, secretName: 'AWS_SECRET_ACCESS_KEY', secretValue: creds.SecretAccessKey });
            await githubService.setRepoSecret({ repoUrl, token, secretName: 'AWS_SESSION_TOKEN', secretValue: creds.SessionToken });

            // STEP 3a: RDS secrets (same as before)
            if (rdsInstance) {
                const rdsMetaPath = path.join(__dirname, `../../terraform/deployments/rds/${rdsInstance}/metadata.json`);
                const rdsMeta = JSON.parse(fs.readFileSync(rdsMetaPath));

                const dbSecrets = {
                    DB_HOST: rdsMeta.rdsEndpoint,
                    DB_PORT: rdsMeta.rdsPort || '5432',
                    DB_NAME: rdsMeta.dbName || '',
                    DB_USER: rdsMeta.dbUsername,
                    DB_PASSWORD: rdsMeta.dbPassword
                };

                for (const [name, value] of Object.entries(dbSecrets)) {
                    await githubService.setRepoSecret({ repoUrl, token, secretName: name, secretValue: String(value) });
                }
            }

            // STEP 3.5: Connect ECS to RDS (same as before)
            try {
                if (rdsInstance) {
                    console.log("Connecting ECS to RDS...");
                    await connectEcsToRds({ credentials: appCredentials, region, ecsCluster, rdsInstance });
                    console.log("ECS connected to RDS successfully");
                }
            } catch (err) {
                console.error("RDS connection failed:", err);
            }

            // STEP 3.6: Configure ALB (same as before)
            try {
                await configureAlb({
                    region,
                    ecsCluster,
                    resolvedContainerAppName,
                    healthCheckPath: req.body.healthCheckPath || "/health",
                    apiPath: req.body.apiPath || "/api/*",
                    priority: req.body.priority || 100,
                    credentials: creds
                });
            } catch (err) {
                console.error("ALB config failed:", err);
            }

            // STEP 4: Trigger GitHub Actions workflow (same as before)

            const workflowId = `deploy-${safeAppName}.yml`;

            const workflowInputs = {
                aws_region: region,
                ecr_registry: ecrRegistry,
                ecr_repo_frontend: ecrRepoFrontend,
                ecr_repo_backend: ecrRepoBackend,
                ecs_cluster: ecsCluster,
                ecs_service_frontend: ecsServiceFrontend,
                ecs_service_backend: ecsServiceBackend,
                ecs_task_def_frontend: ecsTaskDefFrontend,
                ecs_task_def_backend: ecsTaskDefBackend,
                container_name_frontend: containerNameFrontend,
                container_name_backend: containerNameBackend,
                frontend_path: frontendPath || 'frontend',
                backend_path: backendPath || 'backend',
                backend_port: backendPort
            };

            // Small delay to let GitHub index the newly committed workflow file (same as before)
            await new Promise(r => setTimeout(r, 30000));

            const { runId } = await githubService.triggerWorkflow({
                repoUrl, branch, token,
                workflowId,
                inputs: workflowInputs
            });

            if (!runId) {
                throw new Error("GitHub workflow triggered but runId could not be resolved. Try again.");
            }

            // STEP 5: Save deployment record (same as before)
            const deploymentModel = require('../models/deployment.model');
            const repoParts = repoUrl
                .replace(/\.git$/, '')
                .replace(/^https?:\/\/github\.com\//, '')
                .replace(/\/+$/, '')
                .split('/');

            // AFTER
            const { id: deploymentId } = await deploymentModel.createDeployment({
                name: appName || ecsCluster,
                cloud: 'AWS',
                deployment: 'ECS Fargate',
                repoUrl,
                repoName: repoParts[1] || '',
                account: repoParts[0] || account,
                accountID: account,
                userId: req.user?.username,
                workflow: `deploy-${safeAppName}.yml`,
                branch,
                ecsCluster,
                region,
                runId,
                status: 'running',
                triggeredFrom: 'ACP Portal',
                createdAt: new Date().toISOString(),
                ecsServiceBackend: `${appName}-backend`,    // ← ADD
                ecsServiceFrontend: `${appName}-frontend`,  // ← ADD
            });

            // STEP 5b: Fetch ALB DNS and store as url
            const albDns = clusterOutputs.alb_dns_name?.value || null;
            if (albDns && deploymentId) {
                const base = `http://${albDns}`;
                const suffix = frontendBasePath
                    ? '/' + frontendBasePath.replace(/^\/+/, '')
                    : '';
                await deploymentModel.updateStatus(deploymentId, { url: base + suffix });
            }

            // STEP 6: Store runId + deploymentId for the frontend to pick up
            pendingDeployments.set(appName, { runId, deploymentId });
            console.log(`Deployment ready: appName=${appName} runId=${runId} deploymentId=${deploymentId}`);

        } catch (bgError) {
            console.error('Background deploy error:', bgError.message);
            // Store the error so frontend can show it instead of spinning forever
            pendingDeployments.set(appName, { error: bgError.message });
        }

    } catch (error) {
        // This catch only fires if something fails before res.json({ provisioning: true })
        // e.g. terraform output read fails — res hasn't been sent yet so this is safe
        console.error('ECS deploy error:', error?.response?.data || error.message);
        if (!res.headersSent) {
            res.status(500).json({ message: 'ECS deployment failed', error: error.message });
        }
    }
};

// ─── YAML GENERATOR HELPER ────────────────────────────────────────────────────
function generateEcsWorkflowYaml(cfg, appName) {

    return `name: Deploy ${appName} to ECS

on:
  workflow_dispatch:
    inputs:
      aws_region:
        required: true
        type: string
      ecr_registry:
        required: true
        type: string
      ecr_repo_frontend:
        required: true
        type: string
      ecr_repo_backend:
        required: true
        type: string
      ecs_cluster:
        required: true
        type: string
      ecs_service_frontend:
        required: true
        type: string
      ecs_service_backend:
        required: true
        type: string
      ecs_task_def_frontend:
        required: true
        type: string
      ecs_task_def_backend:
        required: true
        type: string
      container_name_frontend:
        required: true
        default: "frontend"
        type: string
      container_name_backend:
        required: true
        default: "backend"
        type: string
      frontend_path:
        required: true
        default: "frontend"
        type: string
      backend_path:
        required: true
        default: "backend"
        type: string
      backend_port:
        required: true
        type: string

env:
  IMAGE_TAG: \${{ github.sha }}

jobs:
  build-and-push:
    name: Build and push images
    runs-on: ubuntu-latest
    outputs:
      frontend_image: \${{ steps.out.outputs.frontend_image }}
      backend_image: \${{ steps.out.outputs.backend_image }}
    steps:
      - uses: actions/checkout@v4
      - uses: aws-actions/configure-aws-credentials@v4
        with:
          aws-access-key-id: \${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: \${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-session-token: \${{ secrets.AWS_SESSION_TOKEN }}
          aws-region: \${{ inputs.aws_region }}
      - uses: aws-actions/amazon-ecr-login@v2
      - name: Build and push frontend
        run: |
          docker build -t \${{ inputs.ecr_registry }}/\${{ inputs.ecr_repo_frontend }}:\${{ env.IMAGE_TAG }} -f \${{ inputs.frontend_path }}/Dockerfile \${{ inputs.frontend_path }}
          docker push \${{ inputs.ecr_registry }}/\${{ inputs.ecr_repo_frontend }}:\${{ env.IMAGE_TAG }}
      - name: Build and push backend
        run: |
          docker build -t \${{ inputs.ecr_registry }}/\${{ inputs.ecr_repo_backend }}:\${{ env.IMAGE_TAG }} -f \${{ inputs.backend_path }}/Dockerfile \${{ inputs.backend_path }}
          docker push \${{ inputs.ecr_registry }}/\${{ inputs.ecr_repo_backend }}:\${{ env.IMAGE_TAG }}
      - id: out
        run: |
          echo "frontend_image=\${{ inputs.ecr_registry }}/\${{ inputs.ecr_repo_frontend }}:\${{ env.IMAGE_TAG }}" >> \$GITHUB_OUTPUT
          echo "backend_image=\${{ inputs.ecr_registry }}/\${{ inputs.ecr_repo_backend }}:\${{ env.IMAGE_TAG }}" >> \$GITHUB_OUTPUT

  deploy-backend:
    name: Deploy backend
    runs-on: ubuntu-latest
    needs: build-and-push
    steps:
      - uses: aws-actions/configure-aws-credentials@v4
        with:
          aws-access-key-id: \${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: \${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-session-token: \${{ secrets.AWS_SESSION_TOKEN }}
          aws-region: \${{ inputs.aws_region }}
      - run: aws ecs describe-task-definition --task-definition \${{ inputs.ecs_task_def_backend }} --query taskDefinition > backend-task-def.json

      - name: Patch container port in task definition
        run: |
          jq '(.containerDefinitions[] | select(.name == "${cfg.containerNameBackend}") | .portMappings) = [{"containerPort": ${cfg.backendPort}, "protocol": "tcp"}]' backend-task-def.json > patched.json && mv patched.json backend-task-def.json

      - id: task-def
        uses: aws-actions/amazon-ecs-render-task-definition@v1
        with:
          task-definition: backend-task-def.json
          container-name: \${{ inputs.container_name_backend }}
          image: \${{ needs.build-and-push.outputs.backend_image }}
          environment-variables: |
            DB_HOST=\${{ secrets.DB_HOST }}
            DB_PORT=\${{ secrets.DB_PORT }}
            DB_NAME=\${{ secrets.DB_NAME }}
            DB_USER=\${{ secrets.DB_USER }}
            DB_PASSWORD=\${{ secrets.DB_PASSWORD }}

      - uses: aws-actions/amazon-ecs-deploy-task-definition@v2
        with:
          task-definition: \${{ steps.task-def.outputs.task-definition }}
          service: \${{ inputs.ecs_service_backend }}
          cluster: \${{ inputs.ecs_cluster }}
          wait-for-service-stability: true

  deploy-frontend:
    name: Deploy frontend
    runs-on: ubuntu-latest
    needs: [build-and-push, deploy-backend]
    steps:
      - uses: aws-actions/configure-aws-credentials@v4
        with:
          aws-access-key-id: \${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: \${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-session-token: \${{ secrets.AWS_SESSION_TOKEN }}
          aws-region: \${{ inputs.aws_region }}
      - run: aws ecs describe-task-definition --task-definition \${{ inputs.ecs_task_def_frontend }} --query taskDefinition > frontend-task-def.json
      - id: task-def
        uses: aws-actions/amazon-ecs-render-task-definition@v1
        with:
          task-definition: frontend-task-def.json
          container-name: \${{ inputs.container_name_frontend }}
          image: \${{ needs.build-and-push.outputs.frontend_image }}
      - uses: aws-actions/amazon-ecs-deploy-task-definition@v2
        with:
          task-definition: \${{ steps.task-def.outputs.task-definition }}
          service: \${{ inputs.ecs_service_frontend }}
          cluster: \${{ inputs.ecs_cluster }}
          wait-for-service-stability: true
`;
}

async function configureAlb({
    region,
    ecsCluster,
    healthCheckPath,
    appName,
    apiPath,
    priority,
    credentials
}) {
    const elb = new ElasticLoadBalancingV2Client({
        region,
        credentials: {
            accessKeyId: credentials.AccessKeyId,
            secretAccessKey: credentials.SecretAccessKey,
            sessionToken: credentials.SessionToken
        }
    });

    // ✅ Get Target Group
    const tgResp = await elb.send(new DescribeTargetGroupsCommand({
        Names: [`${appName}-backend`]
    }));

    const targetGroup = tgResp.TargetGroups[0];
    const targetGroupArn = targetGroup.TargetGroupArn;

    // ✅ Update health check
    await elb.send(new ModifyTargetGroupCommand({
        TargetGroupArn: targetGroupArn,
        HealthCheckPath: healthCheckPath
    }));

    // ✅ Get ALB
    const lbArn = targetGroup.LoadBalancerArns[0];

    // ✅ Get listener (port 80)
    const listeners = await elb.send(new DescribeListenersCommand({
        LoadBalancerArn: lbArn
    }));

    const listener = listeners.Listeners.find(l => l.Port === 80);

    if (!listener) {
        throw new Error("No HTTP listener (port 80) found on ALB");
    }
    const listenerArn = listener.ListenerArn;

    // ✅ Create rule
    await elb.send(new CreateRuleCommand({
        ListenerArn: listenerArn,
        Priority: priority,
        Conditions: [
            {
                Field: "path-pattern",
                Values: [apiPath]
            }
        ],
        Actions: [
            {
                Type: "forward",
                TargetGroupArn: targetGroupArn
            }
        ]
    }));

    console.log("ALB configured successfully");
}

// ─── AZURE CONTAINER APPS DEPLOY ──────────────────────────────────────────────
// In-memory store shared with ECS flow
exports.deployToAzureContainerApps = async (req, res) => {
    try {
        const {
            repoUrl, branch, token,
            frontendPath, backendPath,
            account,                    // Azure account id (subscription id)
            acrName,
            appName,
            containerAppName,
            region,
            cpu,
            memory,
            port,
            frontendBasePath
        } = req.body;

        if (!repoUrl || !appName || !account || !region) {
            return res.status(400).json({ message: 'repoUrl, appName, account and region are required' });
        }

        const safeAppName = (appName || 'app')
            .toLowerCase()
            .replace(/\s+/g, '-')
            .replace(/[^a-z0-9-]/g, '');

        const resolvedContainerAppName = containerAppName || safeAppName;
        const resourceGroupName = `rg-${resolvedContainerAppName}`;
        const generatedAcrName = acrName
            ? acrName.toLowerCase().replace(/[^a-z0-9]/g, '')
            : `acr${safeAppName.replace(/-/g, '')}`;  // ACR names: alphanumeric only

        // Clear any stale pending entry
        pendingDeployments.delete(appName);

        // Respond immediately so the frontend can navigate to the log page
        res.json({ provisioning: true });

        // ── Background job ────────────────────────────────────────────────────
        try {
            const { v4: uuidv4 } = require('uuid');
            const infraController = require('./infra.controller');
            const creds = await infraController.resolveAzureCredentials(account, req.user?.username);
            const tfvars = `
region = "${region}"
resource_group_name = "${resourceGroupName}"
acr_name = "${generatedAcrName}"
container_app_name = "${resolvedContainerAppName}"
container_app_environment_name = "${resolvedContainerAppName}-env"
container_name = "app"
image = "mcr.microsoft.com/azuredocs/containerapps-helloworld:latest"
cpu = ${cpu || 1}
memory = ${memory || 2}
port = ${port || 80}
tags = {
  CreatedBy = "ACP-Portal"
}
`;
            await terraformService.runAzureTerraformDeployment({
              data: {},
              creds,
              templateName: "azure-container-apps",
              typeName: "Azure-Container-Apps",
              deploymentName: resolvedContainerAppName,
              tfvars,
              metadata: {
                id: uuidv4(),
                name: appName,
                type: "Azure-Container-Apps",
                status: "Creating",
                region: region,
                account: account,
                cloud: "Azure",
                userId: req.user?.username,
                acr_name: generatedAcrName
              }
            });

            const workflowName = `deploy-${safeAppName}.yml`;

            // STEP 1: Generate and commit the GitHub Actions workflow
            const workflowContent = generateAzureContainerAppsWorkflowYaml({
                appName: resolvedContainerAppName,
                resourceGroupName,
                containerAppName: resolvedContainerAppName,
                frontendPath: frontendPath || 'frontend',
                backendPath: backendPath || 'backend',
                port: port || 80
            }, appName);

            await githubService.commitWorkflowFile({
                repoUrl,
                branch,
                token,
                workflowContent,
                appName
            });

            // STEP 2: Set Azure SP secrets on the repo
            await githubService.setRepoSecret({ repoUrl, token, secretName: 'AZURE_CLIENT_ID',       secretValue: creds.client_id });
            await githubService.setRepoSecret({ repoUrl, token, secretName: 'AZURE_CLIENT_SECRET',   secretValue: creds.client_secret });
            await githubService.setRepoSecret({ repoUrl, token, secretName: 'AZURE_TENANT_ID',       secretValue: creds.tenant_id });
            await githubService.setRepoSecret({ repoUrl, token, secretName: 'AZURE_SUBSCRIPTION_ID', secretValue: creds.subscription_id });

            // STEP 3: Small delay for GitHub to index the committed workflow file
            await new Promise(r => setTimeout(r, 30000));

            // STEP 4: Trigger workflow
            const { runId } = await githubService.triggerWorkflow({
                repoUrl, branch, token,
                workflowId: workflowName,
                inputs: {
                    azure_region:          region,
                    acr_name:              generatedAcrName,
                    resource_group:        resourceGroupName,
                    container_app_name:    resolvedContainerAppName,
                    frontend_path:         frontendPath || 'frontend',
                    backend_path:          backendPath || 'backend',
                    port:                  String(port || 80)
                }
            });

            if (!runId) {
                throw new Error('Azure workflow triggered but runId could not be resolved.');
            }

            // STEP 5: Save deployment record
            const deploymentModel = require('../models/deployment.model');
            const repoParts = repoUrl
                .replace(/\.git$/, '')
                .replace(/^https?:\/\/github\.com\//, '')
                .replace(/\/+$/, '')
                .split('/');

            const { id: deploymentId } = await deploymentModel.createDeployment({
                name: appName,
                cloud: 'Azure',
                deployment: 'Container Apps',
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
            console.log(`Azure deployment ready: appName=${appName} runId=${runId} deploymentId=${deploymentId}`);

        } catch (bgError) {
            const errorMsg = bgError.response?.data?.message || bgError.message;
            console.error('Azure Container Apps background deploy error:', errorMsg);
            pendingDeployments.set(appName, { error: errorMsg });
        }

    } catch (error) {
        console.error('Azure Container Apps deploy error:', error.message);
        if (!res.headersSent) {
            res.status(500).json({ message: 'Azure Container Apps deployment failed', error: error.message });
        }
    }
};

// ─── AZURE CONTAINER APPS WORKFLOW YAML GENERATOR ────────────────────────────
function generateAzureContainerAppsWorkflowYaml(cfg, appName) {
    return `name: Deploy ${appName} to Azure Container Apps

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
      container_app_name:
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
  IMAGE_TAG: \${{ github.sha }}

jobs:
  build-and-deploy:
    name: Build, push and deploy to Azure Container Apps
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Azure Login
        uses: azure/login@v2
        with:
          creds: |
            {
              "clientId": "\${{ secrets.AZURE_CLIENT_ID }}",
              "clientSecret": "\${{ secrets.AZURE_CLIENT_SECRET }}",
              "tenantId": "\${{ secrets.AZURE_TENANT_ID }}",
              "subscriptionId": "\${{ secrets.AZURE_SUBSCRIPTION_ID }}"
            }

      - name: Log in to ACR
        run: az acr login --name \${{ inputs.acr_name }}

      - name: Build and push backend image
        run: |
          docker build -t \${{ inputs.acr_name }}.azurecr.io/${cfg.containerAppName}-backend:\${{ env.IMAGE_TAG }} -f \${{ inputs.backend_path }}/Dockerfile \${{ inputs.backend_path }}
          docker push \${{ inputs.acr_name }}.azurecr.io/${cfg.containerAppName}-backend:\${{ env.IMAGE_TAG }}

      - name: Deploy backend to Azure Container Apps
        uses: azure/container-apps-deploy-action@v1
        with:
          resourceGroup: \${{ inputs.resource_group }}
          containerAppName: \${{ inputs.container_app_name }}
          imageToDeploy: \${{ inputs.acr_name }}.azurecr.io/${cfg.containerAppName}-backend:\${{ env.IMAGE_TAG }}
`;
}

exports.getListenerRules = async (req, res) => {
    const { region, ecsCluster, account } = req.query;
    const db = require('../config/db');
    const userId = req.user?.username;

    try {
        const dbResult = await db.query(
            `SELECT auth_type, role_arn, external_id, access_key_id, secret_access_key
             FROM cloud_accounts WHERE account_id = $1 AND user_id = $2`,
            [account, userId]
        );
        if (!dbResult.rows.length) return res.status(404).json({ error: 'Cloud account not found' });
        const cloudAccount = dbResult.rows[0];

        let creds;
        if (cloudAccount.auth_type === 'keys') {
            creds = {
                accessKeyId: cloudAccount.access_key_id,
                secretAccessKey: cloudAccount.secret_access_key
            };
        } else {
            const sts = new STSClient({ region });
            const assumeRole = await sts.send(new AssumeRoleCommand({
                RoleArn: cloudAccount.role_arn,
                ExternalId: cloudAccount.external_id,
                RoleSessionName: "acp-alb-rules"
            }));
            creds = {
                accessKeyId: assumeRole.Credentials.AccessKeyId,
                secretAccessKey: assumeRole.Credentials.SecretAccessKey,
                sessionToken: assumeRole.Credentials.SessionToken
            };
        }

        const elb = new ElasticLoadBalancingV2Client({ region, credentials: creds });

        // Get target group for this cluster
        let lbArn;

        try {
            const tgResp = await elb.send(new DescribeTargetGroupsCommand({
                Names: [`${ecsCluster}-backend`]
            }));

            lbArn = tgResp.TargetGroups[0].LoadBalancerArns[0];

        } catch (err) {
            if (err.name === 'TargetGroupNotFoundException' || err.Code === 'TargetGroupNotFound') {
                console.log("No target groups yet - first deployment");
                return res.json([]);
            }

            throw err;
        }

        // Get listener
        const listeners = await elb.send(new DescribeListenersCommand({
            LoadBalancerArn: lbArn
        }));
        const listener = listeners.Listeners.find(l => l.Port === 80);

        // Get all rules
        const rulesResp = await elb.send(new DescribeRulesCommand({
            ListenerArn: listener.ListenerArn
        }));

        const takenPriorities = rulesResp.Rules
            .filter(r => r.Priority !== 'default')
            .map(r => ({
                priority: parseInt(r.Priority),
                path: r.Conditions?.[0]?.Values?.[0] || 'unknown'
            }));

        res.json(takenPriorities);

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
};

exports.checkAcrName = async (req, res) => {
    try {
        const { account, name } = req.query;
        if (!account || !name) {
            return res.status(400).json({ error: 'Missing account or name' });
        }
        
        const infraController = require('./infra.controller');
        const creds = await infraController.resolveAzureCredentials(account, req.user?.username);
        
        if (!creds) {
            return res.status(404).json({ error: 'Azure credentials not found for this account' });
        }

        const axios = require('axios');
        const tokenResponse = await axios.post(
            `https://login.microsoftonline.com/${creds.tenant_id}/oauth2/v2.0/token`,
            new URLSearchParams({
                client_id: creds.client_id,
                client_secret: creds.client_secret,
                grant_type: 'client_credentials',
                scope: 'https://management.azure.com/.default'
            }),
            { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
        );
        const token = tokenResponse.data.access_token;
        
        const url = `https://management.azure.com/subscriptions/${creds.subscription_id}/providers/Microsoft.ContainerRegistry/checkNameAvailability?api-version=2023-01-01-preview`;
        
        const checkResponse = await axios.post(url, {
            name: name,
            type: "Microsoft.ContainerRegistry/registries"
        }, { headers: { Authorization: `Bearer ${token}` } });

        res.json(checkResponse.data);
    } catch (err) {
        console.error('ACR check name failed:', err.response?.data || err.message);
        res.status(500).json({ error: 'Failed to check ACR name availability' });
    }
};
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
            .replace(/\s+/g, '-')
            .replace(/[^a-z0-9-]/g, '');

        const resolvedAppServiceName = appServiceName || safeAppName;
        const resourceGroupName = `rg-${resolvedAppServiceName}`;
        const generatedAcrName = acrName
            ? acrName.toLowerCase().replace(/[^a-z0-9]/g, '')
            : `acr${safeAppName.replace(/-/g, '')}`;  // ACR names: alphanumeric only

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
            console.log(`Starting background Terraform provisioning for Azure App Service: ${resolvedAppServiceName}`);
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
            const workflowName = `deploy-${safeAppName}-app-service.yml`;
            const githubService = require('../services/github.service');
            await githubService.commitFile(
                repoUrl,
                `.github/workflows/${workflowName}`,
                workflowYaml,
                `Add ACP Azure App Service Deployment Workflow for ${appName}`,
                branch,
                token
            );

            // Wait a moment for GitHub to index the workflow file
            console.log("Waiting 30s for GitHub to index the new workflow...");
            await new Promise(r => setTimeout(r, 30000));

            // STEP 4: Trigger the workflow
            const { runId } = await githubService.triggerWorkflow({
                repoUrl,
                workflowId: workflowName,
                branch,
                token,
                inputs: {
                    azure_region: region,
                    acr_name: generatedAcrName,
                    resource_group: resourceGroupName,
                    app_service_name: resolvedAppServiceName,
                    backend_path: backendPath || "backend",
                    frontend_path: frontendPath || "frontend",
                    port: (port || "80").toString()
                }
            });

            if (!runId) {
                throw new Error("GitHub workflow triggered but runId could not be resolved. Try again.");
            }

            // STEP 5: Save deployment record
            const deploymentModel = require('../models/deployment.model');
            const repoParts = repoUrl
                .replace(/\.git$/, '')
                .replace(/^https?:\/\/github\.com\//, '')
                .replace(/\/+$/, '')
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
            console.log(`Azure App Service deployment ready: appName=${appName} runId=${runId} deploymentId=${deploymentId}`);

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
    return `name: Deploy ${appName} to Azure App Service

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
  IMAGE_TAG: \${{ github.sha }}

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
              "clientId": "\${{ secrets.AZURE_CLIENT_ID }}",
              "clientSecret": "\${{ secrets.AZURE_CLIENT_SECRET }}",
              "tenantId": "\${{ secrets.AZURE_TENANT_ID }}",
              "subscriptionId": "\${{ secrets.AZURE_SUBSCRIPTION_ID }}"
            }

      - name: Log in to ACR
        run: az acr login --name \${{ inputs.acr_name }}

      - name: Build and push backend image
        run: |
          docker build -t \${{ inputs.acr_name }}.azurecr.io/\${{ inputs.app_service_name }}-backend:\${{ env.IMAGE_TAG }} -f \${{ inputs.backend_path }}/Dockerfile \${{ inputs.backend_path }}
          docker push \${{ inputs.acr_name }}.azurecr.io/\${{ inputs.app_service_name }}-backend:\${{ env.IMAGE_TAG }}

      - name: Deploy to Azure App Service
        uses: azure/webapps-deploy@v2
        with:
          app-name: \${{ inputs.app_service_name }}
          images: \${{ inputs.acr_name }}.azurecr.io/\${{ inputs.app_service_name }}-backend:\${{ env.IMAGE_TAG }}
`;
}

exports.deployToAzureAks = async (req, res) => {
    try {
        const {
            repoUrl, branch, token,
            frontendPath, backendPath,
            account,
            acrName,
            appName,
            aksCluster,
            aksResourceGroup,
            region,
            port,
            namespace
        } = req.body;

        if (!repoUrl || !appName || !account || !region || !aksCluster) {
            return res.status(400).json({ message: 'repoUrl, appName, account, region and aksCluster are required' });
        }

        const safeAppName = (appName || 'app')
            .toLowerCase()
            .replace(/\\s+/g, '-')
            .replace(/[^a-z0-9-]/g, '');

        const generatedAcrName = acrName
            ? acrName.toLowerCase().replace(/[^a-z0-9]/g, '')
            : ('acr' + safeAppName.replace(/-/g, '').substring(0, 20));

        pendingDeployments.delete(appName);
        res.json({ provisioning: true });

        try {
            const infraController = require('./infra.controller');
            const creds = await infraController.resolveAzureCredentials(account, req.user?.username);

            if (!creds) throw new Error("Azure credentials not found for this account");

            const terraformService = require('../services/terraform.service');
            await terraformService.createAzureAksAcr({
                accountID: account,
                region,
                appName: safeAppName,
                aksCluster,
                acrName: generatedAcrName,
                port: port || 80,
                zoneName: aksCluster
            }, creds, req.user?.username);

            await new Promise(r => setTimeout(r, 2000));

            const workflowName = 'deploy-' + safeAppName + '-aks.yml';
            const workflowYaml = generateAzureAksWorkflowYaml({
                aksCluster,
                aksResourceGroup: aksResourceGroup || ('rg-' + safeAppName),
                acrName: generatedAcrName,
                namespace: namespace || 'default'
            }, appName);

            const githubService = require('../services/github.service');
            await githubService.commitFile(
                repoUrl,
                '.github/workflows/' + workflowName,
                workflowYaml,
                'Add ACP Azure AKS Deployment Workflow for ' + appName,
                branch,
                token
            );

            await githubService.setRepoSecret({ repoUrl, token, secretName: 'AZURE_CLIENT_ID', secretValue: creds.client_id });
            await githubService.setRepoSecret({ repoUrl, token, secretName: 'AZURE_CLIENT_SECRET', secretValue: creds.client_secret });
            await githubService.setRepoSecret({ repoUrl, token, secretName: 'AZURE_TENANT_ID', secretValue: creds.tenant_id });
            await githubService.setRepoSecret({ repoUrl, token, secretName: 'AZURE_SUBSCRIPTION_ID', secretValue: creds.subscription_id });

            console.log("Waiting 30s for GitHub to index the new workflow...");
            await new Promise(r => setTimeout(r, 30000));

            const { runId } = await githubService.triggerWorkflow({
                repoUrl,
                workflowId: workflowName,
                branch,
                token,
                inputs: {
                    azure_region: region,
                    acr_name: generatedAcrName,
                    aks_cluster: aksCluster,
                    aks_resource_group: aksResourceGroup || ('rg-' + safeAppName),
                    namespace: namespace || 'default',
                    backend_path: backendPath || 'backend',
                    frontend_path: frontendPath || 'frontend',
                    port: (port || '80').toString()
                }
            });

            if (!runId) throw new Error("GitHub workflow triggered but runId could not be resolved.");

            const deploymentModel = require('../models/deployment.model');
            const repoParts = repoUrl.replace(/\.git$/, '').replace(/^https?:\/\/github\.com\//, '').replace(/\/+$/, '').split('/');

            const { id: deploymentId } = await deploymentModel.createDeployment({
                name: appName,
                cloud: 'Azure',
                deployment: 'AKS',
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

            pendingDeployments.set(appName, { runId, deploymentId });
            console.log('Azure AKS deployment ready: appName=' + appName + ' runId=' + runId);

        } catch (bgError) {
            const errorMsg = bgError.response?.data?.message || bgError.message;
            console.error('Azure AKS background deploy error:', errorMsg);
            pendingDeployments.set(appName, { error: errorMsg });
        }

    } catch (error) {
        console.error('Azure AKS deploy error:', error.message);
        if (!res.headersSent) {
            res.status(500).json({ message: 'Azure AKS deployment failed', error: error.message });
        }
    }
};

function generateAzureAksWorkflowYaml(cfg, appName) {
    const acrRef = cfg.acrName || '${{ inputs.acr_name }}';
    return 'name: Deploy ' + appName + ' to Azure AKS\n\n' +
'on:\n' +
'  workflow_dispatch:\n' +
'    inputs:\n' +
'      azure_region:\n' +
'        required: true\n' +
'        type: string\n' +
'      acr_name:\n' +
'        required: true\n' +
'        type: string\n' +
'      aks_cluster:\n' +
'        required: true\n' +
'        type: string\n' +
'      aks_resource_group:\n' +
'        required: true\n' +
'        type: string\n' +
'      namespace:\n' +
'        required: true\n' +
'        default: "default"\n' +
'        type: string\n' +
'      frontend_path:\n' +
'        required: true\n' +
'        default: "frontend"\n' +
'        type: string\n' +
'      backend_path:\n' +
'        required: true\n' +
'        default: "backend"\n' +
'        type: string\n' +
'      port:\n' +
'        required: true\n' +
'        default: "80"\n' +
'        type: string\n\n' +
'env:\n' +
'  IMAGE_TAG: ${{ github.sha }}\n\n' +
'jobs:\n' +
'  build-and-deploy:\n' +
'    name: Build, push and deploy to AKS\n' +
'    runs-on: ubuntu-latest\n' +
'    steps:\n' +
'      - uses: actions/checkout@v4\n\n' +
'      - name: Azure Login\n' +
'        uses: azure/login@v2\n' +
'        with:\n' +
'          creds: |\n' +
'            {\n' +
'              "clientId": "${{ secrets.AZURE_CLIENT_ID }}",\n' +
'              "clientSecret": "${{ secrets.AZURE_CLIENT_SECRET }}",\n' +
'              "tenantId": "${{ secrets.AZURE_TENANT_ID }}",\n' +
'              "subscriptionId": "${{ secrets.AZURE_SUBSCRIPTION_ID }}"\n' +
'            }\n\n' +
'      - name: Log in to ACR\n' +
'        run: az acr login --name ${{ inputs.acr_name }}\n\n' +
'      - name: Build and push backend image\n' +
'        run: |\n' +
'          docker build -t ${{ inputs.acr_name }}.azurecr.io/' + cfg.acrName + '-backend:${{ env.IMAGE_TAG }} -f ${{ inputs.backend_path }}/Dockerfile ${{ inputs.backend_path }}\n' +
'          docker push ${{ inputs.acr_name }}.azurecr.io/' + cfg.acrName + '-backend:${{ env.IMAGE_TAG }}\n\n' +
'      - name: Build and push frontend image\n' +
'        run: |\n' +
'          docker build -t ${{ inputs.acr_name }}.azurecr.io/' + cfg.acrName + '-frontend:${{ env.IMAGE_TAG }} -f ${{ inputs.frontend_path }}/Dockerfile ${{ inputs.frontend_path }}\n' +
'          docker push ${{ inputs.acr_name }}.azurecr.io/' + cfg.acrName + '-frontend:${{ env.IMAGE_TAG }}\n\n' +
'      - name: Set AKS context\n' +
'        uses: azure/aks-set-context@v3\n' +
'        with:\n' +
'          resource-group: ${{ inputs.aks_resource_group }}\n' +
'          cluster-name: ${{ inputs.aks_cluster }}\n\n' +
'      - name: Deploy backend to AKS\n' +
'        uses: azure/k8s-deploy@v4\n' +
'        with:\n' +
'          namespace: ${{ inputs.namespace }}\n' +
'          images: ${{ inputs.acr_name }}.azurecr.io/' + cfg.acrName + '-backend:${{ env.IMAGE_TAG }}\n\n' +
'      - name: Deploy frontend to AKS\n' +
'        uses: azure/k8s-deploy@v4\n' +
'        with:\n' +
'          namespace: ${{ inputs.namespace }}\n' +
'          images: ${{ inputs.acr_name }}.azurecr.io/' + cfg.acrName + '-frontend:${{ env.IMAGE_TAG }}\n';
}
