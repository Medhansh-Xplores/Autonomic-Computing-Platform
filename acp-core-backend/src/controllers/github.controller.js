const githubService = require('../services/github.service');
const axios = require("axios");
const { connectEcsToRds } = require('../services/aws.service');
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

        if (runId) {
            const runResp = await axios.get(
                `https://api.github.com/repos/${owner}/${repo}/actions/runs/${runId}`,
                { headers }
            );
            run = runResp.data;
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
exports.deployToEcs = async (req, res) => {
    try {
        const {
            // GitHub
            repoUrl, branch, token,
            // Monorepo paths
            frontendPath, backendPath,
            // AWS
            account, region, ecsCluster, rdsInstance,
            // App
            appName,
            // AWS credentials to inject as secrets
            awsAccessKeyId, awsSecretAccessKey
        } = req.body;

        const backendPort = req.body.backendPort || '4000';

        console.log("Deploy ECS payload:", {
            repoUrl,
            branch,
            frontendPath,
            backendPath,
            account,
            region,
            ecsCluster,
            rdsInstance,
            appName
        });

        // Step 1.5: Run ecs-app Terraform (creates ECR repos, task defs, services, ALB rules)
        const terraformService = require('../services/terraform.service');
        const { execSync } = require('child_process');
        const path = require('path');
        const fs = require('fs');

        // Read ECS cluster terraform outputs
        const ecsDeployPath = path.join(__dirname, `../../terraform/deployments/ecs/${ecsCluster}`);
        let clusterOutputs = {};
        try {
            const raw = execSync('terraform output -json', { cwd: ecsDeployPath }).toString();
            clusterOutputs = JSON.parse(raw);
        } catch (e) {
            return res.status(500).json({ message: 'Could not read ECS cluster outputs. Has the ECS cluster been created?', error: e.message });
        }
        console.log("CLUSTER OUTPUTS:", clusterOutputs);

        // Read ECS cluster metadata to get vpcId
        const ecsMetaPath = path.join(__dirname, `../../terraform/deployments/ecs/${ecsCluster}/metadata.json`);
        const ecsMeta = JSON.parse(fs.readFileSync(ecsMetaPath));
        const vpcId = ecsMeta.vpcId;

        await terraformService.createECSApp({
            account,
            region,
            appName: appName || ecsCluster,
            zoneName: ecsCluster,
            vpcId: vpcId,                          // add vpcId to frontend payload
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
        });

        // Derive names from Terraform naming convention
        // Your Terraform uses: cluster_name-frontend / cluster_name-backend
        // ECR uses: zone_name-frontend / zone_name-backend
        // Since portal knows cluster_name, we derive zone_name from it or use cluster_name
        const ecsServiceFrontend = `${appName}-frontend`;
        const ecsServiceBackend = `${appName}-backend`;
        const ecsTaskDefFrontend = `${appName}-frontend`;
        const ecsTaskDefBackend = `${appName}-backend`;
        const ecrRepoFrontend = `${appName}-frontend`;
        const ecrRepoBackend = `${appName}-backend`;
        const containerNameFrontend = 'frontend';   // hardcoded in your Terraform
        const containerNameBackend = 'backend';    // hardcoded in your Terraform

        // Get ECR registry URL (account.dkr.ecr.region.amazonaws.com)
        const ecrRegistry = `${account}.dkr.ecr.${region}.amazonaws.com`;

        // Step 1: Generate the workflow YAML content
        // Read the template file OR generate inline
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
        });

        // Step 2: Commit workflow file to repo
        await githubService.commitWorkflowFile({
            repoUrl, branch, token,
            workflowContent
        });

        // Step 3: Set AWS secrets on repo
        // Use the portal's assumed-role credentials for the target account
        const { STSClient, AssumeRoleCommand } = require('@aws-sdk/client-sts');
        const sts = new STSClient({ region: 'us-east-1' });
        const roleResp = await sts.send(new AssumeRoleCommand({
            RoleArn: `arn:aws:iam::${account}:role/ACPDeploymentRole`,
            RoleSessionName: 'ACPDeploySession'
        }));
        const creds = roleResp.Credentials;

        await githubService.setRepoSecret({
            repoUrl, token,
            secretName: 'AWS_ACCESS_KEY_ID',
            secretValue: creds.AccessKeyId
        });
        await githubService.setRepoSecret({
            repoUrl, token,
            secretName: 'AWS_SECRET_ACCESS_KEY',
            secretValue: creds.SecretAccessKey
        });
        await githubService.setRepoSecret({
            repoUrl, token,
            secretName: 'AWS_SESSION_TOKEN',
            secretValue: creds.SessionToken
        });

        if (rdsInstance) {
            const fs = require('fs');
            const path = require('path');
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
        // Step 3.5: Connect ECS to selected RDS
        try {
            if (rdsInstance) {
                console.log("Connecting ECS to RDS...");
                await connectEcsToRds({
                    account,
                    region,
                    ecsCluster,
                    rdsInstance
                });
                console.log("ECS connected to RDS successfully");
            }
        } catch (err) {
            console.error("RDS connection failed:", err);
        }

        // Step 3.6: Configure ALB
        try {
            await configureAlb({
                region,
                ecsCluster,
                appName,
                healthCheckPath: req.body.healthCheckPath || "/health",
                apiPath: req.body.apiPath || "/api/*",
                priority: req.body.priority || 100,
                credentials: creds
            });
        } catch (err) {
            console.error("ALB config failed:", err);
        }

        // Step 4: Trigger the workflow
        const workflowId = 'deploy-to-ecs.yml';
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

        // Small delay to let GitHub index the newly committed workflow file
        await new Promise(r => setTimeout(r, 3000));

        const { runId } = await githubService.triggerWorkflow({
            repoUrl, branch, token,
            workflowId,
            inputs: workflowInputs
        });

        // Step 5: Save deployment record
        const deploymentService = require('../services/deployments.service');
        const { id: deploymentId } = deploymentService.createDeployment({
            name: appName || ecsCluster,
            cloud: 'AWS',
            deployment: 'ECS Fargate',
            repoUrl,
            branch,
            ecsCluster,
            region,
            account,
            runId,
            status: 'running',
            triggeredFrom: 'ACP Portal',
            createdAt: new Date().toISOString()
        });

        res.json({ runId, deploymentId });

    } catch (error) {
        console.error('ECS deploy error:', error?.response?.data || error.message);
        res.status(500).json({ message: 'ECS deployment failed', error: error.message });
    }
};

// ─── YAML GENERATOR HELPER ────────────────────────────────────────────────────
function generateEcsWorkflowYaml(cfg) {
    return `name: Deploy to ECS (Blue/Green)

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

exports.getListenerRules = async (req, res) => {
    const { region, ecsCluster, account } = req.query;

    try {
        const sts = new STSClient({ region });
        const assumeRole = await sts.send(new AssumeRoleCommand({
            RoleArn: `arn:aws:iam::${account}:role/ACPDeploymentRole`,
            RoleSessionName: "acp-alb-rules"
        }));

        const creds = {
            accessKeyId: assumeRole.Credentials.AccessKeyId,
            secretAccessKey: assumeRole.Credentials.SecretAccessKey,
            sessionToken: assumeRole.Credentials.SessionToken
        };

        const elb = new ElasticLoadBalancingV2Client({ region, credentials: creds });

        // Get target group for this cluster
        let lbArn;

        try {
            const tgResp = await elb.send(new DescribeTargetGroupsCommand({
                Names: [`${ecsCluster}-backend`]  // we’ll improve this later
            }));

            lbArn = tgResp.TargetGroups[0].LoadBalancerArns[0];

        } catch (err) {
            if (err.name === 'TargetGroupNotFoundException' || err.Code === 'TargetGroupNotFound') {
                console.log("No target groups yet - first deployment");

                // 👇 RETURN EMPTY STATE
                return res.json([]);
            }

            throw err; // real error
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