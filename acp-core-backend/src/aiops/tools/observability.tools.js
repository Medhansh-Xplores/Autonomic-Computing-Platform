/**
 * observability.tools.js
 *
 * Google ADK tool definitions that wrap the existing ACP observability service.
 * These are READ-ONLY tools — the agents use them to gather data.
 *
 * Each tool follows the ADK FunctionTool signature:
 *   { name, description, parameters (JSON Schema), handler async fn }
 */

const observabilityService = require('../../services/observability.service');
const db = require('../../config/db');
const {
    ECSClient,
    DescribeClustersCommand,
    ListClustersCommand,
} = require('@aws-sdk/client-ecs');
const {
    RDSClient,
    DescribeDBInstancesCommand,
} = require('@aws-sdk/client-rds');
const {
    ElasticLoadBalancingV2Client,
    DescribeLoadBalancersCommand,
    DescribeTargetGroupsCommand,
    DescribeTargetHealthCommand,
} = require('@aws-sdk/client-elastic-load-balancing-v2');
const {
    STSClient,
    AssumeRoleCommand,
} = require('@aws-sdk/client-sts');
const {
    EC2Client,
    DescribeVpcsCommand,
    DescribeSubnetsCommand,
    DescribeRouteTablesCommand,
    DescribeInternetGatewaysCommand,
    DescribeNatGatewaysCommand,
} = require('@aws-sdk/client-ec2');

// ── Credential helper (same pattern as observability.controller.js) ───────────
async function resolveCredentials(accountId, userId, region) {
    const result = await db.query(
        `SELECT auth_type, role_arn, external_id, access_key_id, secret_access_key
         FROM cloud_accounts WHERE (account_id = $1 OR id::text = $1) AND user_id = $2 LIMIT 1`,
        [accountId, userId]
    );
    if (!result.rows.length) throw new Error(`Cloud account not found: ${accountId}`);
    const account = result.rows[0];

    if (account.auth_type === 'keys') {
        return {
            accessKeyId: account.access_key_id,
            secretAccessKey: account.secret_access_key,
        };
    }

    const sts = new STSClient({ region });
    const assumed = await sts.send(new AssumeRoleCommand({
        RoleArn: account.role_arn,
        ExternalId: account.external_id,
        RoleSessionName: 'acp-aiops-agent',
    }));
    return {
        accessKeyId: assumed.Credentials.AccessKeyId,
        secretAccessKey: assumed.Credentials.SecretAccessKey,
        sessionToken: assumed.Credentials.SessionToken,
    };
}

// ─────────────────────────────────────────────────────────────────────────────
// TOOL 1 — get_app_health
// Used by: App Health Agent
// ─────────────────────────────────────────────────────────────────────────────
const getAppHealth = {
    name: 'get_app_health',
    description: `Fetch the full health status of an ECS-based application deployed in ACP Portal.
Returns: status (healthy/degraded/unhealthy), running vs desired task counts,
CloudWatch alarm list, target group health, recent ECS events, and CPU/memory metrics.
Call this once per application you want to assess.`,

    parameters: {
        type: 'object',
        properties: {
            accountId: { type: 'string', description: 'AWS account ID or cloud_accounts DB id' },
            region: { type: 'string', description: 'AWS region, e.g. us-east-1' },
            cluster: { type: 'string', description: 'ECS cluster name' },
            serviceName: { type: 'string', description: 'Application name (without -backend/-frontend suffix)' },
            userId: { type: 'string', description: 'ACP Portal username, used for credential lookup' },
        },
        required: ['accountId', 'region', 'cluster', 'serviceName', 'userId'],
    },

    handler: async ({ accountId, region, cluster, serviceName, userId }) => {
        try {
            const credentials = await resolveCredentials(accountId, userId, region);
            const backendSvc = `${serviceName}-backend`;
            const frontendSvc = `${serviceName}-frontend`;

            const [ecsBackend, ecsFrontend, tasksBackend, tasksFrontend,
                metricsResult, alarms, targetGroupHealth] = await Promise.allSettled([
                    observabilityService.describeEcsService(credentials, region, cluster, backendSvc),
                    observabilityService.describeEcsService(credentials, region, cluster, frontendSvc),
                    observabilityService.describeEcsTasks(credentials, region, cluster, backendSvc),
                    observabilityService.describeEcsTasks(credentials, region, cluster, frontendSvc),
                    observabilityService.getEcsMetrics(credentials, region, cluster, backendSvc),
                    observabilityService.getActiveAlarms(credentials, region, cluster),
                    observabilityService.getTargetGroupHealth(credentials, region, cluster),
                ]);

            const backend = ecsBackend.status === 'fulfilled' ? ecsBackend.value : null;
            const frontend = ecsFrontend.status === 'fulfilled' ? ecsFrontend.value : null;
            const tasks = [
                ...(tasksBackend.status === 'fulfilled' ? tasksBackend.value : []),
                ...(tasksFrontend.status === 'fulfilled' ? tasksFrontend.value : []),
            ];
            const metrics = metricsResult.status === 'fulfilled' ? metricsResult.value : {};
            const alarmsVal = alarms.status === 'fulfilled' ? alarms.value : [];
            const tgHealth = targetGroupHealth.status === 'fulfilled' ? targetGroupHealth.value : null;

            const running = (backend?.runningCount ?? 0) + (frontend?.runningCount ?? 0);
            const desired = (backend?.desiredCount ?? 0) + (frontend?.desiredCount ?? 0);

            let status = 'unknown';
            if (desired === 0 && running === 0) {
                status = 'unhealthy';
            } else if (desired > 0) {
                if (alarmsVal.length > 0 || running === 0) status = 'unhealthy';
                else if (running < desired) status = 'degraded';
                else status = 'healthy';
            }

            const stoppedTasks = tasks.filter(t => t.stoppedReason);

            return {
                status,
                serviceName,
                cluster,
                region,
                runningCount: running,
                desiredCount: desired,
                metrics,
                activeAlarms: alarmsVal,
                targetGroupHealth: tgHealth,
                stoppedTaskReasons: stoppedTasks.map(t => ({
                    taskArn: t.taskArn?.split('/').pop(),
                    reason: t.stoppedReason,
                })),
                recentEvents: (backend?.events || frontend?.events || []).slice(0, 5).map(e => ({
                    message: e.message,
                    createdAt: e.createdAt,
                })),
            };
        } catch (err) {
            return { error: err.message, serviceName, status: 'unknown' };
        }
    },
};

// ─────────────────────────────────────────────────────────────────────────────
// TOOL 2 — get_all_deployments_health
// Used by: App Health Agent
// ─────────────────────────────────────────────────────────────────────────────
const getAllDeploymentsHealth = {
    name: 'get_all_deployments_health',
    description: `Returns a summary health status for EVERY deployment stored in the ACP Portal DB for a given user.
Useful to get a broad picture of which apps need attention before diving into individual ones.
Returns { deployments: [{ id, name, status, runningCount, desiredCount, activeAlarms }] }.`,

    parameters: {
        type: 'object',
        properties: {
            userId: { type: 'string', description: 'ACP Portal username' },
        },
        required: ['userId'],
    },

    handler: async ({ userId }) => {
        console.log('[app-agent] getAllDeploymentsHealth called for userId:', userId);
        try {
            const deploymentModel = require('../../models/deployment.model');
            const deployments = await deploymentModel.getDeployments(userId);
            console.log('[app-agent] deployments found:', deployments.length);

            const results = await Promise.all(deployments.map(async (d) => {
                const id = d.id;
                const name = d.name;
                const ecsCluster = d.ecsCluster || d.cluster || d.clusterName;
                const region = d.region;
                const accountID = d.accountID || d.account || d.awsAccountId;
                // Log ALL keys present in this deployment blob so mismatches are visible in backend logs
                console.log(`[app-agent] deployment "${name}" keys:`, Object.keys(d).join(', '));
                console.log(`[app-agent] resolved — ecsCluster=${ecsCluster}, region=${region}, accountID=${accountID}`);
                if (!ecsCluster || !region || !accountID) {
                    console.warn(`[app-agent] SKIPPING "${name}" (${id}) — missing ECS metadata. Keys in data blob: ${Object.keys(d).join(', ')}`);
                    return { id, name, status: 'unknown', reason: `Missing ECS metadata (ecsCluster=${ecsCluster}, region=${region}, accountID=${accountID})` };
                }
                try {
                    const credentials = await resolveCredentials(accountID, userId, region);
                    const backendSvc = d.ecsServiceBackend || `${name}-backend`;
                    const frontendSvc = d.ecsServiceFrontend || `${name}-frontend`;

                    const [ecsBackend, ecsFrontend, alarms] = await Promise.allSettled([
                        observabilityService.describeEcsService(credentials, region, ecsCluster, backendSvc),
                        observabilityService.describeEcsService(credentials, region, ecsCluster, frontendSvc),
                        observabilityService.getActiveAlarms(credentials, region, ecsCluster),
                    ]);

                    const backend = ecsBackend.status === 'fulfilled' ? ecsBackend.value : null;
                    const frontend = ecsFrontend.status === 'fulfilled' ? ecsFrontend.value : null;
                    const alarmsVal = alarms.status === 'fulfilled' ? alarms.value : [];
                    const running = (backend?.runningCount ?? 0) + (frontend?.runningCount ?? 0);
                    const desired = (backend?.desiredCount ?? 0) + (frontend?.desiredCount ?? 0);

                    let status = 'unknown';
                    if (desired === 0 && running === 0) {
                        status = 'unhealthy';
                    } else if (desired > 0) {
                        if (alarmsVal.length > 0 || running === 0) status = 'unhealthy';
                        else if (running < desired) status = 'degraded';
                        else status = 'healthy';
                    }
                    return {
                        id, name, status,
                        runningCount: running,
                        desiredCount: desired,
                        activeAlarms: alarmsVal.length,
                        cluster: ecsCluster,
                        ecsServiceBackend: backendSvc,
                        ecsServiceFrontend: frontendSvc,
                        region,
                        accountId: accountID,
                    };
                } catch (err) {
                    return { id, name, status: 'unknown', reason: err.message };
                }
            }));

            return { deployments: results };
        } catch (err) {
            return { error: err.message };
        }
    },
};

// ─────────────────────────────────────────────────────────────────────────────
// TOOL 3 — get_ecs_cluster_health
// Used by: Infra Monitoring Agent
// ─────────────────────────────────────────────────────────────────────────────
const getEcsClusterHealth = {
    name: 'get_ecs_cluster_health',
    description: `Fetch health and metrics for all ECS clusters in an AWS account/region.
Returns cluster status, running/pending task counts, active service counts, and CPU/memory utilization.`,

    parameters: {
        type: 'object',
        properties: {
            accountId: { type: 'string' },
            region: { type: 'string' },
            userId: { type: 'string' },
        },
        required: ['accountId', 'region', 'userId'],
    },

    handler: async ({ accountId, region, userId }) => {
        try {
            const credentials = await resolveCredentials(accountId, userId, region);
            const ecs = new ECSClient({ region, credentials });
            const list = await ecs.send(new ListClustersCommand({}));
            if (!list.clusterArns?.length) return { clusters: [] };

            const desc = await ecs.send(new DescribeClustersCommand({ clusters: list.clusterArns }));
            const clusters = (desc.clusters || []).map(c => ({
                name: c.clusterName,
                arn: c.clusterArn,
                status: c.status,
                runningTasksCount: c.runningTasksCount ?? 0,
                pendingTasksCount: c.pendingTasksCount ?? 0,
                activeServicesCount: c.activeServicesCount ?? 0,
            }));
            return { clusters };
        } catch (err) {
            return { error: err.message };
        }
    },
};

// ─────────────────────────────────────────────────────────────────────────────
// TOOL 4 — get_rds_health
// Used by: Infra Monitoring Agent
// ─────────────────────────────────────────────────────────────────────────────
const getRdsHealth = {
    name: 'get_rds_health',
    description: `Fetch health status for all RDS instances in an AWS account/region.
Returns identifier, engine, status (available/stopped/rebooting/etc), instance class, and endpoint.
A status other than 'available' is a problem worth investigating.`,

    parameters: {
        type: 'object',
        properties: {
            accountId: { type: 'string' },
            region: { type: 'string' },
            userId: { type: 'string' },
        },
        required: ['accountId', 'region', 'userId'],
    },

    handler: async ({ accountId, region, userId }) => {
        try {
            const credentials = await resolveCredentials(accountId, userId, region);
            const rds = new RDSClient({ region, credentials });
            const resp = await rds.send(new DescribeDBInstancesCommand({}));
            const instances = (resp.DBInstances || []).map(db => ({
                identifier: db.DBInstanceIdentifier,
                engine: db.Engine,
                status: db.DBInstanceStatus,
                instanceClass: db.DBInstanceClass,
                multiAz: db.MultiAZ,
                endpoint: db.Endpoint?.Address || null,
            }));
            const unhealthy = instances.filter(i => i.status !== 'available');
            return { instances, unhealthyCount: unhealthy.length, unhealthy };
        } catch (err) {
            return { error: err.message };
        }
    },
};

// ─────────────────────────────────────────────────────────────────────────────
// TOOL 5 — get_alb_health
// Used by: Infra Monitoring Agent
// ─────────────────────────────────────────────────────────────────────────────
const getAlbHealth = {
    name: 'get_alb_health',
    description: `Fetch health of all Application Load Balancers in an account/region.
Returns ALB state, and for each target group: how many targets are healthy vs total.
If healthyCount < totalCount, there is a problem routing traffic to that service.`,

    parameters: {
        type: 'object',
        properties: {
            accountId: { type: 'string' },
            region: { type: 'string' },
            userId: { type: 'string' },
        },
        required: ['accountId', 'region', 'userId'],
    },

    handler: async ({ accountId, region, userId }) => {
        try {
            const credentials = await resolveCredentials(accountId, userId, region);
            const elb = new ElasticLoadBalancingV2Client({ region, credentials });

            const lbResp = await elb.send(new DescribeLoadBalancersCommand({}));
            const tgResp = await elb.send(new DescribeTargetGroupsCommand({}));

            const tgHealthResults = await Promise.all((tgResp.TargetGroups || []).map(async tg => {
                const h = await elb.send(new DescribeTargetHealthCommand({ TargetGroupArn: tg.TargetGroupArn }));
                const targets = h.TargetHealthDescriptions || [];
                return {
                    name: tg.TargetGroupName,
                    lbArns: tg.LoadBalancerArns || [],
                    healthyCount: targets.filter(t => t.TargetHealth?.State === 'healthy').length,
                    totalCount: targets.length,
                };
            }));

            const loadBalancers = (lbResp.LoadBalancers || []).map(lb => {
                const tgs = tgHealthResults.filter(tg => tg.lbArns.includes(lb.LoadBalancerArn));
                const unhealthyTgs = tgs.filter(tg => tg.healthyCount < tg.totalCount);
                return {
                    name: lb.LoadBalancerName,
                    arn: lb.LoadBalancerArn,
                    state: lb.State?.Code,
                    targetGroups: tgs.map(({ lbArns, ...rest }) => rest),
                    hasUnhealthyTargets: unhealthyTgs.length > 0,
                };
            });

            return {
                loadBalancers,
                unhealthyAlbs: loadBalancers.filter(lb => lb.state !== 'active' || lb.hasUnhealthyTargets),
            };
        } catch (err) {
            return { error: err.message };
        }
    },
};

// ─────────────────────────────────────────────────────────────────────────────
// TOOL 6 — get_cloudwatch_alarms
// Used by: both agents
// ─────────────────────────────────────────────────────────────────────────────
const getCloudWatchAlarms = {
    name: 'get_cloudwatch_alarms',
    description: `Fetch all active CloudWatch alarms (state = ALARM) for a given cluster prefix.
Returns alarm name, description, and stateReason. An empty array means no active alarms.`,

    parameters: {
        type: 'object',
        properties: {
            accountId: { type: 'string' },
            region: { type: 'string' },
            userId: { type: 'string' },
            clusterPrefix: { type: 'string', description: 'ECS cluster name used as alarm name prefix' },
        },
        required: ['accountId', 'region', 'userId', 'clusterPrefix'],
    },

    handler: async ({ accountId, region, userId, clusterPrefix }) => {
        try {
            const credentials = await resolveCredentials(accountId, userId, region);
            const alarms = await observabilityService.getActiveAlarms(credentials, region, clusterPrefix);
            return { alarms, count: alarms.length };
        } catch (err) {
            return { error: err.message, alarms: [] };
        }
    },
};

// ─────────────────────────────────────────────────────────────────────────────
// TOOL 7 — get_vpc_health
// Used by: Infra Monitoring Agent
// ─────────────────────────────────────────────────────────────────────────────
const getVpcHealth = {
    name: 'get_vpc_health',
    description: `Fetch health status for all VPCs in an AWS account/region.
For each VPC returns: state, subnets (with AZ, type, available IPs, state),
whether an Internet Gateway is attached, NAT gateway count and states, and route table count.
Use this to detect VPC misconfigurations that could cause ECS or RDS connectivity issues.`,

    parameters: {
        type: 'object',
        properties: {
            accountId: { type: 'string', description: 'AWS account ID or cloud_accounts DB id' },
            region: { type: 'string', description: 'AWS region, e.g. us-east-1' },
            userId: { type: 'string', description: 'ACP Portal username, used for credential lookup' },
        },
        required: ['accountId', 'region', 'userId'],
    },

    handler: async ({ accountId, region, userId }) => {
        try {
            const credentials = await resolveCredentials(accountId, userId, region);
            const ec2 = new EC2Client({ region, credentials });

            const vpcsResp = await ec2.send(new DescribeVpcsCommand({}));
            const vpcList = vpcsResp.Vpcs || [];

            const vpcs = await Promise.all(vpcList.map(async vpc => {
                const nameTag = vpc.Tags?.find(t => t.Key === 'Name')?.Value || vpc.VpcId;

                const [subnetsResp, rtResp, igwResp, natResp] = await Promise.all([
                    ec2.send(new DescribeSubnetsCommand({
                        Filters: [{ Name: 'vpc-id', Values: [vpc.VpcId] }],
                    })),
                    ec2.send(new DescribeRouteTablesCommand({
                        Filters: [{ Name: 'vpc-id', Values: [vpc.VpcId] }],
                    })),
                    ec2.send(new DescribeInternetGatewaysCommand({
                        Filters: [{ Name: 'attachment.vpc-id', Values: [vpc.VpcId] }],
                    })),
                    ec2.send(new DescribeNatGatewaysCommand({
                        Filter: [{ Name: 'vpc-id', Values: [vpc.VpcId] }],
                    })),
                ]);

                const subnets = (subnetsResp.Subnets || []).map(s => ({
                    subnetId: s.SubnetId,
                    name: s.Tags?.find(t => t.Key === 'Name')?.Value || s.SubnetId,
                    az: s.AvailabilityZone,
                    type: s.MapPublicIpOnLaunch ? 'public' : 'private',
                    cidr: s.CidrBlock,
                    availableIps: s.AvailableIpAddressCount,
                    state: s.State,
                }));

                const natGateways = (natResp.NatGateways || [])
                    .filter(n => n.State !== 'deleted')
                    .map(n => ({ natGatewayId: n.NatGatewayId, state: n.State }));

                const internetGatewayAttached = (igwResp.InternetGateways || []).length > 0;
                const routeTableCount = (rtResp.RouteTables || []).length;

                // Detect issues
                const issues = [];
                if (vpc.State !== 'available') issues.push(`VPC state is '${vpc.State}'`);
                const unavailableSubnets = subnets.filter(s => s.state !== 'available');
                if (unavailableSubnets.length > 0)
                    issues.push(`${unavailableSubnets.length} subnet(s) not available: ${unavailableSubnets.map(s => s.subnetId).join(', ')}`);
                if (!internetGatewayAttached)
                    issues.push('No Internet Gateway attached — public subnets cannot reach the internet');
                const unhealthyNats = natGateways.filter(n => n.state !== 'available');
                if (unhealthyNats.length > 0)
                    issues.push(`${unhealthyNats.length} NAT Gateway(s) not available: ${unhealthyNats.map(n => `${n.natGatewayId}(${n.state})`).join(', ')}`);

                return {
                    vpcId: vpc.VpcId,
                    name: nameTag,
                    cidr: vpc.CidrBlock,
                    state: vpc.State,
                    internetGatewayAttached,
                    natGateways,
                    routeTableCount,
                    subnets,
                    healthy: issues.length === 0,
                    issues,
                };
            }));

            const unhealthyVpcs = vpcs.filter(v => !v.healthy);
            return {
                vpcs,
                vpcsChecked: vpcs.length,
                unhealthyCount: unhealthyVpcs.length,
                unhealthyVpcs,
            };
        } catch (err) {
            return { error: err.message };
        }
    },
};

// ── Wrap plain tool objects as ADK FunctionTool instances ─────────────────────
// ADK dispatches tool calls via tool.runAsync(). Plain {name, handler} objects
// don't have runAsync, so Gemini's functionCall events are silently swallowed
// and agents produce zero output. FunctionTool adds the required runAsync method.
const { FunctionTool } = require('@google/adk');

// WITH this — use the 3-argument FunctionTool constructor:
function toFunctionTool(toolDef) {
    return new FunctionTool({
        name: toolDef.name,
        description: toolDef.description,
        parameters: toolDef.parameters,
        execute: toolDef.handler,   // ADK calls this via runAsync → execute(args, toolContext)
    });
}

module.exports = {
    getAppHealth: toFunctionTool(getAppHealth),
    getAllDeploymentsHealth: toFunctionTool(getAllDeploymentsHealth),
    getEcsClusterHealth: toFunctionTool(getEcsClusterHealth),
    getRdsHealth: toFunctionTool(getRdsHealth),
    getAlbHealth: toFunctionTool(getAlbHealth),
    getCloudWatchAlarms: toFunctionTool(getCloudWatchAlarms),
    getVpcHealth: toFunctionTool(getVpcHealth),
};
