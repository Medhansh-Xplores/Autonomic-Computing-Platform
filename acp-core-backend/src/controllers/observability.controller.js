const db = require('../config/db');
const {
    EC2Client,
    DescribeVpcsCommand,
    DescribeSubnetsCommand,
    DescribeRouteTablesCommand,
    DescribeInternetGatewaysCommand,
    DescribeNatGatewaysCommand,
    DescribeSecurityGroupsCommand,
    DescribeFlowLogsCommand,
    DescribeVpcAttributeCommand,   // ADD THIS
} = require('@aws-sdk/client-ec2');
const {
    RDSClient,
    DescribeDBInstancesCommand,
    DescribeDBLogFilesCommand,
    DownloadDBLogFilePortionCommand,
} = require('@aws-sdk/client-rds');
const {
    CloudWatchClient,
    GetMetricDataCommand,
    DescribeAlarmsCommand,
    GetMetricStatisticsCommand,
} = require('@aws-sdk/client-cloudwatch');
const {
    ElasticLoadBalancingV2Client,
    DescribeLoadBalancersCommand,
    DescribeTargetGroupsCommand,
    DescribeTargetHealthCommand,
    DescribeListenersCommand,
    DescribeLoadBalancerAttributesCommand,
    DescribeTagsCommand,
} = require('@aws-sdk/client-elastic-load-balancing-v2');
const {
    STSClient,
    AssumeRoleCommand,
} = require('@aws-sdk/client-sts');
const {
    ECSClient,
    DescribeClustersCommand,
    ListClustersCommand,
    DescribeServicesCommand,
    ListServicesCommand,
    ListTasksCommand,
    DescribeTasksCommand,
} = require('@aws-sdk/client-ecs');

const observabilityService = require('../services/observability.service');
const deploymentModel = require('../models/deployment.model');
const IS_LOCAL = process.env.NODE_ENV !== 'production';

// ── In-memory cache (30 s TTL) ────────────────────────────────────────────────
const cache = new Map();
const CACHE_TTL_MS = 30 * 1000;

function getCached(key) {
    const entry = cache.get(key);
    if (!entry) return null;
    if (Date.now() - entry.ts > CACHE_TTL_MS) { cache.delete(key); return null; }
    return entry.data;
}

function setCached(key, data) {
    cache.set(key, { ts: Date.now(), data });
}

// ── Credential resolution (mirrors infra.controller.js pattern) ───────────────
async function resolveCredentials(accountId, userId, region) {
    const result = await db.query(
        `SELECT auth_type, role_arn, external_id, access_key_id, secret_access_key
         FROM cloud_accounts WHERE (account_id = $1 OR id::text = $1) AND user_id = $2 LIMIT 1`,
        [accountId, userId]
    );
    if (!result.rows.length) throw new Error('Cloud account not found');
    const account = result.rows[0];

    if (account.auth_type === 'keys') {
        return {
            accessKeyId: account.access_key_id,
            secretAccessKey: account.secret_access_key,
            sessionToken: undefined,
        };
    }

    const sts = new STSClient({ region });
    const assumed = await sts.send(new AssumeRoleCommand({
        RoleArn: account.role_arn,
        ExternalId: account.external_id,
        RoleSessionName: 'acp-observability',
    }));
    return {
        accessKeyId: assumed.Credentials.AccessKeyId,
        secretAccessKey: assumed.Credentials.SecretAccessKey,
        sessionToken: assumed.Credentials.SessionToken,
    };
}

// ── Composite status logic ────────────────────────────────────────────────────
function computeStatus({ service, alarms, targetGroupHealth }) {
    const running = service?.runningCount ?? 0;
    const desired = service?.desiredCount ?? 0;

    if (desired === 0) return 'unknown';
    if (alarms.length > 0) return 'unhealthy';
    if (running === 0) return 'unhealthy';
    if (targetGroupHealth && targetGroupHealth.healthyCount === 0) return 'unhealthy';
    if (running < desired) return 'degraded';
    if (targetGroupHealth && targetGroupHealth.healthyCount < targetGroupHealth.totalCount) return 'degraded';
    return 'healthy';
}

// ── GET /api/v1/observability/health ─────────────────────────────────────────
// Query params: account, region, cluster, service
// ── GET /api/v1/observability/health ─────────────────────────────────────────
// Query params: account, region, cluster, service
exports.getHealth = async (req, res) => {
    const { account, region, cluster, service: serviceName } = req.query;
    const userId = req.user?.username;

    if (!account || !region || !cluster || !serviceName) {
        return res.status(400).json({
            error: 'Missing required query params: account, region, cluster, service',
        });
    }

    const cacheKey = `${userId}:${account}:${region}:${cluster}:${serviceName}`;
    const cached = getCached(cacheKey);
    if (cached) return res.json(cached);

    try {
        const credentials = await resolveCredentials(account, userId, region);

        // Derive the two real ECS service names from the app name
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

        // Use backend as primary for deployment/event metadata; fall back to frontend
        const primaryService = backend || frontend;

        const tasks = [
            ...(tasksBackend.status === 'fulfilled' ? tasksBackend.value : []),
            ...(tasksFrontend.status === 'fulfilled' ? tasksFrontend.value : []),
        ];

        const metricsVal = metricsResult.status === 'fulfilled'
            ? metricsResult.value
            : { cpuUtilization: null, memoryUtilization: null };

        // If Container Insights isn't enabled, fall back to task-level reserved capacity
        if (metricsVal.cpuUtilization === null && metricsVal.memoryUtilization === null) {
            const allTasks = [
                ...(tasksBackend.status === 'fulfilled' ? tasksBackend.value : []),
                ...(tasksFrontend.status === 'fulfilled' ? tasksFrontend.value : []),
            ];
            if (allTasks.length > 0) {
                const totalCpuUnits = allTasks.reduce((s, t) => s + (parseInt(t.cpu) || 0), 0);
                const totalMemMiB = allTasks.reduce((s, t) => s + (parseInt(t.memory) || 0), 0);
                metricsVal.cpuReservedUnits = totalCpuUnits;
                metricsVal.memoryReservedMiB = totalMemMiB;
            }
        }

        const alarmsVal = alarms.status === 'fulfilled' ? alarms.value : [];
        const tgHealth = targetGroupHealth.status === 'fulfilled' ? targetGroupHealth.value : null;

        // Merge running/desired/pending counts across both services
        const mergedService = (backend || frontend) ? {
            runningCount: (backend?.runningCount ?? 0) + (frontend?.runningCount ?? 0),
            desiredCount: (backend?.desiredCount ?? 0) + (frontend?.desiredCount ?? 0),
            pendingCount: (backend?.pendingCount ?? 0) + (frontend?.pendingCount ?? 0),
        } : null;

        // Pull the last 5 events from the primary service
        const recentEvents = (primaryService?.events || []).slice(0, 5).map(e => ({
            message: e.message,
            createdAt: e.createdAt,
        }));

        // Deployment info from the active deployment on the primary service
        const activeDeployment = (primaryService?.deployments || []).find(d => d.status === 'PRIMARY');

        const status = computeStatus({ service: mergedService, alarms: alarmsVal, targetGroupHealth: tgHealth });

        const payload = {
            status,
            service: {
                name: serviceName,
                cluster,
                region,
                runningCount: mergedService?.runningCount ?? 0,
                desiredCount: mergedService?.desiredCount ?? 0,
                pendingCount: mergedService?.pendingCount ?? 0,
                taskDefinition: primaryService?.taskDefinition?.split('/').pop() ?? null,
                createdAt: primaryService?.createdAt ?? null,
            },
            deployment: activeDeployment ? {
                status: activeDeployment.status,
                rolloutState: activeDeployment.rolloutState,
                rolloutStateReason: activeDeployment.rolloutStateReason,
                updatedAt: activeDeployment.updatedAt,
                runningCount: activeDeployment.runningCount,
                desiredCount: activeDeployment.desiredCount,
            } : null,
            tasks: tasks.map(t => ({
                taskArn: t.taskArn?.split('/').pop(),
                lastStatus: t.lastStatus,
                healthStatus: t.healthStatus,
                cpu: t.cpu,
                memory: t.memory,
                startedAt: t.startedAt,
                stoppedReason: t.stoppedReason || null,
            })),
            metrics: metricsVal,
            alarms: alarmsVal,
            targetGroupHealth: tgHealth,
            recentEvents,
            fetchedAt: new Date().toISOString(),
        };

        setCached(cacheKey, payload);
        res.json(payload);

    } catch (err) {
        console.error('[observability]', err.message);
        res.status(500).json({ error: err.message });
    }
};

// ── GET /api/v1/observability/deployments-health ──────────────────────────────
// Returns lightweight health status for ALL deployments stored in DB
// AFTER
exports.getAllDeploymentsHealth = async (req, res) => {
    const userId = req.user?.username;

    if (!userId) {
        return res.status(401).json({ error: 'Unauthorized: no user identity found' });
    }

    try {
        const deployments = await deploymentModel.getDeployments(userId);

        // For each deployment that has ECS metadata, fetch health in parallel
        const healthChecks = deployments.map(async (d) => {
            const { id, name, ecsCluster, region, accountID, status: dbStatus } = d;

            // AFTER
            if (!ecsCluster || !region || !accountID) {
                const missing = [!ecsCluster && 'ecsCluster', !region && 'region', !accountID && 'accountID'].filter(Boolean);
                return { id, name, status: 'unknown', reason: `Missing ECS metadata: ${missing.join(', ')}` };
            }

            const cacheKey = `${userId}:${accountID}:${region}:${ecsCluster}:${name}`;
            const cached = getCached(cacheKey);
            if (cached) return { id, name, status: cached.status, metrics: cached.metrics, service: cached.service };

            // AFTER
            try {
                const credentials = await resolveCredentials(accountID, userId, region);

                // Derive the two real ECS service names (stored on record, or fall back to convention)
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

                // Merge running/desired counts from both services
                const mergedService = (backend || frontend) ? {
                    runningCount: (backend?.runningCount ?? 0) + (frontend?.runningCount ?? 0),
                    desiredCount: (backend?.desiredCount ?? 0) + (frontend?.desiredCount ?? 0),
                } : null;

                const status = computeStatus({ service: mergedService, alarms: alarmsVal, targetGroupHealth: null });

                return {
                    id,
                    name,
                    status,
                    service: {
                        runningCount: mergedService?.runningCount ?? 0,
                        desiredCount: mergedService?.desiredCount ?? 0,
                    },
                };
            } catch (err) {
                return { id, name, status: 'unknown', reason: err.message };
            }
        });

        const results = await Promise.all(healthChecks);
        res.json(results);

    } catch (err) {
        console.error('[observability/all]', err.message);
        res.status(500).json({ error: err.message });
    }
};

// ── GET /api/v1/observability/acp-portal-health ───────────────────────────────
// Fixed to account 377122171982 — the only account ACP Portal runs on
const ACP_PORTAL_ACCOUNT_ID = '377122171982';

exports.getAcpPortalHealth = async (req, res) => {
    const { region, cluster, service: serviceName } = req.query;
    const userId = req.user?.username;

    if (!region || !cluster || !serviceName) {
        return res.status(400).json({
            error: 'Missing required query params: region, cluster, service',
        });
    }

    // ── Local dev: return a mock payload so the UI is fully testable ──────────
    if (IS_LOCAL) {
        return res.json({
            status: 'healthy',
            accountId: '377122171982',
            _mock: true,   // flag so UI can show a banner
            service: {
                name: serviceName,
                cluster,
                region,
                runningCount: 2,
                desiredCount: 2,
                pendingCount: 0,
                taskDefinition: 'acp-portal:42',
                createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
            },
            deployment: {
                status: 'PRIMARY',
                rolloutState: 'COMPLETED',
                rolloutStateReason: 'ECS deployment completed.',
                updatedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
                runningCount: 2,
                desiredCount: 2,
            },
            tasks: [
                { taskArn: 'mock-task-abc123', lastStatus: 'RUNNING', healthStatus: 'HEALTHY', cpu: '512', memory: '1024', startedAt: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(), stoppedReason: null },
                { taskArn: 'mock-task-def456', lastStatus: 'RUNNING', healthStatus: 'HEALTHY', cpu: '512', memory: '1024', startedAt: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(), stoppedReason: null },
            ],
            metrics: { cpuUtilization: 34.2, memoryUtilization: 51.7 },
            alarms: [],
            targetGroupHealth: { targetGroupName: 'acp-portal-tg', healthyCount: 2, totalCount: 2 },
            recentEvents: [
                { message: '(service acp-portal) has reached a steady state.', createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString() },
            ],
            fetchedAt: new Date().toISOString(),
        });
    }

    const cacheKey = `acp-portal:${region}:${cluster}:${serviceName}`;
    const cached = getCached(cacheKey);
    if (cached) return res.json(cached);

    try {
        // ACP Portal always runs inside account 377122171982.
        // Use the ECS task role directly — no DB lookup needed, no account registration required.
        const credentials = undefined;

        const [ecsService, ecsTasks, metrics, alarms, targetGroupHealth] = await Promise.allSettled([
            observabilityService.describeEcsService(credentials, region, cluster, serviceName),
            observabilityService.describeEcsTasks(credentials, region, cluster, serviceName),
            observabilityService.getEcsMetrics(credentials, region, cluster, serviceName),
            observabilityService.getActiveAlarms(credentials, region, cluster),
            observabilityService.getTargetGroupHealth(credentials, region, cluster),
        ]);

        const service = ecsService.status === 'fulfilled' ? ecsService.value : null;
        const tasks = ecsTasks.status === 'fulfilled' ? ecsTasks.value : [];
        const metricsVal = metrics.status === 'fulfilled' ? metrics.value : { cpuUtilization: null, memoryUtilization: null };
        const alarmsVal = alarms.status === 'fulfilled' ? alarms.value : [];
        const tgHealth = targetGroupHealth.status === 'fulfilled' ? targetGroupHealth.value : null;

        const recentEvents = (service?.events || []).slice(0, 5).map(e => ({
            message: e.message,
            createdAt: e.createdAt,
        }));

        const activeDeployment = (service?.deployments || []).find(d => d.status === 'PRIMARY');
        const status = computeStatus({ service, alarms: alarmsVal, targetGroupHealth: tgHealth });

        const payload = {
            status,
            accountId: ACP_PORTAL_ACCOUNT_ID,
            service: {
                name: serviceName,
                cluster,
                region,
                runningCount: service?.runningCount ?? 0,
                desiredCount: service?.desiredCount ?? 0,
                pendingCount: service?.pendingCount ?? 0,
                taskDefinition: service?.taskDefinition?.split('/').pop() ?? null,
                createdAt: service?.createdAt ?? null,
            },
            deployment: activeDeployment ? {
                status: activeDeployment.status,
                rolloutState: activeDeployment.rolloutState,
                rolloutStateReason: activeDeployment.rolloutStateReason,
                updatedAt: activeDeployment.updatedAt,
                runningCount: activeDeployment.runningCount,
                desiredCount: activeDeployment.desiredCount,
            } : null,
            tasks: tasks.map(t => ({
                taskArn: t.taskArn?.split('/').pop(),
                lastStatus: t.lastStatus,
                healthStatus: t.healthStatus,
                cpu: t.cpu,
                memory: t.memory,
                startedAt: t.startedAt,
                stoppedReason: t.stoppedReason || null,
            })),
            metrics: metricsVal,
            alarms: alarmsVal,
            targetGroupHealth: tgHealth,
            recentEvents,
            fetchedAt: new Date().toISOString(),
        };

        setCached(cacheKey, payload);
        res.json(payload);

    } catch (err) {
        console.error('[acp-portal-health]', err.message);
        res.status(500).json({ error: err.message });
    }
};

// ── NEW: GET /api/v1/observability/acp-portal-infra-health ──────────────────
// Returns health/status for VPC, RDS, and ALB that were provisioned by acp-terraform

const ACP_CLUSTER_TAG = 'acp-cluster'; // tag/name prefix used by acp-terraform

exports.getAcpVpcHealth = async (req, res) => {
    const { region } = req.query;
    if (!region) return res.status(400).json({ error: 'Missing region' });

    if (IS_LOCAL) {
        return res.json({
            _mock: true,
            vpcs: [
                {
                    vpcId: 'vpc-0abc123mock',
                    name: 'acp-vpc',
                    cidr: '10.0.0.0/16',
                    state: 'available',
                    subnets: [
                        { subnetId: 'subnet-pub1', name: 'acp-public-1', az: 'us-east-1a', type: 'public', cidr: '10.0.1.0/24', state: 'available' },
                        { subnetId: 'subnet-priv1', name: 'acp-private-1', az: 'us-east-1b', type: 'private', cidr: '10.0.2.0/24', state: 'available' },
                    ],
                },
            ],
            fetchedAt: new Date().toISOString(),
        });
    }

    const cacheKey = `acp-vpc:${region}`;
    const cached = getCached(cacheKey);
    if (cached) return res.json(cached);

    try {
        const ec2 = new EC2Client({ region });

        // Find VPCs tagged/named with acp prefix
        const vpcsResp = await ec2.send(new DescribeVpcsCommand({
            Filters: [{ Name: 'tag:Name', Values: ['acp-*'] }],
        }));

        const vpcs = await Promise.all((vpcsResp.Vpcs || []).map(async vpc => {
            const nameTag = vpc.Tags?.find(t => t.Key === 'Name')?.Value || vpc.VpcId;
            const subnetsResp = await ec2.send(new DescribeSubnetsCommand({
                Filters: [{ Name: 'vpc-id', Values: [vpc.VpcId] }],
            }));

            const subnets = (subnetsResp.Subnets || []).map(s => ({
                subnetId: s.SubnetId,
                name: s.Tags?.find(t => t.Key === 'Name')?.Value || s.SubnetId,
                az: s.AvailabilityZone,
                type: s.MapPublicIpOnLaunch ? 'public' : 'private',
                cidr: s.CidrBlock,
                state: s.State,
            }));

            return {
                vpcId: vpc.VpcId,
                name: nameTag,
                cidr: vpc.CidrBlock,
                state: vpc.State,
                subnets,
            };
        }));

        const payload = { vpcs, fetchedAt: new Date().toISOString() };
        setCached(cacheKey, payload);
        res.json(payload);

    } catch (err) {
        console.error('[acp-vpc-health]', err.message);
        res.status(500).json({ error: err.message });
    }
};

exports.getAcpRdsHealth = async (req, res) => {
    const { region } = req.query;
    if (!region) return res.status(400).json({ error: 'Missing region' });

    if (IS_LOCAL) {
        return res.json({
            _mock: true,
            instances: [
                {
                    identifier: 'acp-postgres',
                    engine: 'postgres',
                    engineVersion: '15.4',
                    status: 'available',
                    instanceClass: 'db.t3.micro',
                    multiAz: false,
                    endpoint: 'acp-postgres.mock.us-east-1.rds.amazonaws.com',
                    port: 5432,
                    storageGb: 20,
                    createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
                },
            ],
            fetchedAt: new Date().toISOString(),
        });
    }

    const cacheKey = `acp-rds:${region}`;
    const cached = getCached(cacheKey);
    if (cached) return res.json(cached);

    try {
        const rds = new RDSClient({ region });
        const resp = await rds.send(new DescribeDBInstancesCommand({}));

        // Filter to instances whose identifier starts with 'acp-'
        const instances = (resp.DBInstances || [])
            .filter(db => db.DBInstanceIdentifier.startsWith('acp-'))
            .map(db => ({
                identifier: db.DBInstanceIdentifier,
                engine: db.Engine,
                engineVersion: db.EngineVersion,
                status: db.DBInstanceStatus,
                instanceClass: db.DBInstanceClass,
                multiAz: db.MultiAZ,
                endpoint: db.Endpoint?.Address || null,
                port: db.Endpoint?.Port || null,
                storageGb: db.AllocatedStorage,
                createdAt: db.InstanceCreateTime?.toISOString() || null,
            }));

        const payload = { instances, fetchedAt: new Date().toISOString() };
        setCached(cacheKey, payload);
        res.json(payload);

    } catch (err) {
        console.error('[acp-rds-health]', err.message);
        res.status(500).json({ error: err.message });
    }
};

exports.getAcpAlbHealth = async (req, res) => {
    const { region } = req.query;
    if (!region) return res.status(400).json({ error: 'Missing region' });

    if (IS_LOCAL) {
        return res.json({
            _mock: true,
            loadBalancers: [
                {
                    name: 'acp-alb',
                    arn: 'arn:aws:elasticloadbalancing:us-east-1:377122171982:loadbalancer/app/acp-alb/mock',
                    dns: 'acp-alb-mock.us-east-1.elb.amazonaws.com',
                    scheme: 'internet-facing',
                    state: 'active',
                    type: 'application',
                    targetGroups: [
                        { name: 'acp-backend-tg', healthy: 2, total: 2 },
                        { name: 'acp-frontend-tg', healthy: 2, total: 2 },
                    ],
                },
            ],
            fetchedAt: new Date().toISOString(),
        });
    }

    const cacheKey = `acp-alb:${region}`;
    const cached = getCached(cacheKey);
    if (cached) return res.json(cached);

    try {
        const elb = new ElasticLoadBalancingV2Client({ region });
        const lbResp = await elb.send(new DescribeLoadBalancersCommand({}));

        const acpLbs = (lbResp.LoadBalancers || []).filter(lb =>
            lb.LoadBalancerName.toLowerCase().startsWith('acp-')
        );

        const tgResp = await elb.send(new DescribeTargetGroupsCommand({}));
        const acpTgs = (tgResp.TargetGroups || []).filter(tg =>
            tg.LoadBalancerArns?.some(arn => acpLbs.find(lb => lb.LoadBalancerArn === arn))
        );

        const tgHealthPromises = acpTgs.map(tg =>
            elb.send(new DescribeTargetHealthCommand({ TargetGroupArn: tg.TargetGroupArn }))
                .then(r => {
                    const targets = r.TargetHealthDescriptions || [];
                    return {
                        name: tg.TargetGroupName,
                        healthy: targets.filter(t => t.TargetHealth?.State === 'healthy').length,
                        total: targets.length,
                    };
                })
        );
        const tgHealthResults = await Promise.all(tgHealthPromises);

        const loadBalancers = acpLbs.map(lb => ({
            name: lb.LoadBalancerName,
            arn: lb.LoadBalancerArn,
            dns: lb.DNSName,
            scheme: lb.Scheme,
            state: lb.State?.Code,
            type: lb.Type,
            targetGroups: tgHealthResults,
        }));

        const payload = { loadBalancers, fetchedAt: new Date().toISOString() };
        setCached(cacheKey, payload);
        res.json(payload);

    } catch (err) {
        console.error('[acp-alb-health]', err.message);
        res.status(500).json({ error: err.message });
    }
};

// ── NEW: GET /api/v1/observability/infra-vpc-health ───────────────────────────
// User's VPCs in any account/region they registered — no acp- prefix filter

exports.getInfraVpcHealth = async (req, res) => {
    const { region, accountId } = req.query;
    const userId = req.user?.username;
    if (!region || !accountId) return res.status(400).json({ error: 'Missing region or accountId' });

    const cacheKey = `infra-vpc:${userId}:${accountId}:${region}`;
    const cached = getCached(cacheKey);
    if (cached) return res.json(cached);

    try {
        const credentials = await resolveCredentials(accountId, userId, region);
        const ec2 = new EC2Client({ region, credentials });

        const vpcsResp = await ec2.send(new DescribeVpcsCommand({}));

        const vpcs = await Promise.all((vpcsResp.Vpcs || []).map(async vpc => {
            const nameTag = vpc.Tags?.find(t => t.Key === 'Name')?.Value || vpc.VpcId;
            const subnetsResp = await ec2.send(new DescribeSubnetsCommand({
                Filters: [{ Name: 'vpc-id', Values: [vpc.VpcId] }],
            }));
            const subnets = (subnetsResp.Subnets || []).map(s => ({
                subnetId: s.SubnetId,
                name: s.Tags?.find(t => t.Key === 'Name')?.Value || s.SubnetId,
                az: s.AvailabilityZone,
                type: s.MapPublicIpOnLaunch ? 'public' : 'private',
                cidr: s.CidrBlock,
                state: s.State,
            }));
            return { vpcId: vpc.VpcId, name: nameTag, cidr: vpc.CidrBlock, state: vpc.State, subnets };
        }));

        const payload = { vpcs, fetchedAt: new Date().toISOString() };
        setCached(cacheKey, payload);
        res.json(payload);
    } catch (err) {
        console.error('[infra-vpc-health]', err.message);
        res.status(500).json({ error: err.message });
    }
};

exports.getInfraVpcDetail = async (req, res) => {
    const { region, accountId, vpcId } = req.query;
    const userId = req.user?.username;
    if (!region || !accountId || !vpcId) return res.status(400).json({ error: 'Missing region, accountId or vpcId' });

    const cacheKey = `infra-vpc-detail:${userId}:${accountId}:${region}:${vpcId}`;
    const cached = getCached(cacheKey);
    if (cached) return res.json(cached);

    try {
        const credentials = await resolveCredentials(accountId, userId, region);
        const ec2 = new EC2Client({ region, credentials });

        // ── VPC base info ──────────────────────────────────────────────────────
        const vpcResp = await ec2.send(new DescribeVpcsCommand({
            Filters: [{ Name: 'vpc-id', Values: [vpcId] }],
        }));
        const vpc = vpcResp.Vpcs?.[0];
        if (!vpc) return res.status(404).json({ error: 'VPC not found' });

        const nameTag = vpc.Tags?.find(t => t.Key === 'Name')?.Value || vpcId;
        const tenancy = vpc.InstanceTenancy || 'default';
        const tags = (vpc.Tags || []).filter(t => t.Key !== 'Name');

        // DNS attributes require separate API calls
        const [dnsHostnamesResp, dnsResolutionResp] = await Promise.all([
            ec2.send(new DescribeVpcAttributeCommand({ VpcId: vpcId, Attribute: 'enableDnsHostnames' })),
            ec2.send(new DescribeVpcAttributeCommand({ VpcId: vpcId, Attribute: 'enableDnsSupport' })),
        ]);
        const dnsHostnames = dnsHostnamesResp.EnableDnsHostnames?.Value ?? false;
        const dnsResolution = dnsResolutionResp.EnableDnsSupport?.Value ?? false;

        // ── Subnets ────────────────────────────────────────────────────────────
        const subnetsResp = await ec2.send(new DescribeSubnetsCommand({
            Filters: [{ Name: 'vpc-id', Values: [vpcId] }],
        }));
        const subnets = (subnetsResp.Subnets || []).map(s => ({
            subnetId: s.SubnetId,
            name: s.Tags?.find(t => t.Key === 'Name')?.Value || s.SubnetId,
            az: s.AvailabilityZone,
            type: s.MapPublicIpOnLaunch ? 'public' : 'private',
            cidr: s.CidrBlock,
            availableIps: s.AvailableIpAddressCount,
            state: s.State,
        }));

        // ── Route tables ───────────────────────────────────────────────────────
        const rtResp = await ec2.send(new DescribeRouteTablesCommand({
            Filters: [{ Name: 'vpc-id', Values: [vpcId] }],
        }));
        const routeTableCount = (rtResp.RouteTables || []).length;

        // ── Internet Gateway ───────────────────────────────────────────────────
        const igwResp = await ec2.send(new DescribeInternetGatewaysCommand({
            Filters: [{ Name: 'attachment.vpc-id', Values: [vpcId] }],
        }));
        const internetGatewayAttached = (igwResp.InternetGateways || []).length > 0;

        // ── NAT Gateways ───────────────────────────────────────────────────────
        const natResp = await ec2.send(new DescribeNatGatewaysCommand({
            Filter: [{ Name: 'vpc-id', Values: [vpcId] }],
        }));
        const natGatewayCount = (natResp.NatGateways || []).filter(n => n.State !== 'deleted').length;

        // ── Security groups ────────────────────────────────────────────────────
        const sgResp = await ec2.send(new DescribeSecurityGroupsCommand({
            Filters: [{ Name: 'vpc-id', Values: [vpcId] }],
        }));
        const securityGroupCount = (sgResp.SecurityGroups || []).length;

        // ── Flow logs (latest 5) ───────────────────────────────────────────────
        const flResp = await ec2.send(new DescribeFlowLogsCommand({
            Filter: [{ Name: 'resource-id', Values: [vpcId] }],
        }));
        const flowLogs = (flResp.FlowLogs || []).slice(0, 5).map(fl => ({
            flowLogId: fl.FlowLogId,
            status: fl.FlowLogStatus,
            trafficType: fl.TrafficType,
            destination: fl.LogDestination || fl.LogGroupName || '—',
            deliverStatus: fl.DeliverLogsStatus || '—',
            createdAt: fl.CreationTime?.toISOString() || null,
        }));

        const payload = {
            vpcId,
            name: nameTag,
            cidr: vpc.CidrBlock,
            state: vpc.State,
            region,
            dnsHostnames,
            dnsResolution,
            tenancy,
            subnets,
            routeTableCount,
            internetGatewayAttached,
            natGatewayCount,
            securityGroupCount,
            flowLogs,
            tags,
            fetchedAt: new Date().toISOString(),
        };

        setCached(cacheKey, payload);
        res.json(payload);
    } catch (err) {
        console.error('[infra-vpc-detail]', err.message);
        res.status(500).json({ error: err.message });
    }
};

exports.getInfraRdsHealth = async (req, res) => {
    const { region, accountId } = req.query;
    const userId = req.user?.username;
    if (!region || !accountId) return res.status(400).json({ error: 'Missing region or accountId' });

    const cacheKey = `infra-rds:${userId}:${accountId}:${region}`;
    const cached = getCached(cacheKey);
    if (cached) return res.json(cached);

    try {
        const credentials = await resolveCredentials(accountId, userId, region);
        const rds = new RDSClient({ region, credentials });
        const resp = await rds.send(new DescribeDBInstancesCommand({}));

        const instances = (resp.DBInstances || []).map(db => ({
            identifier: db.DBInstanceIdentifier,
            engine: db.Engine,
            engineVersion: db.EngineVersion,
            status: db.DBInstanceStatus,
            instanceClass: db.DBInstanceClass,
            multiAz: db.MultiAZ,
            endpoint: db.Endpoint?.Address || null,
            port: db.Endpoint?.Port || null,
            storageGb: db.AllocatedStorage,
            createdAt: db.InstanceCreateTime?.toISOString() || null,
        }));

        const payload = { instances, fetchedAt: new Date().toISOString() };
        setCached(cacheKey, payload);
        res.json(payload);
    } catch (err) {
        console.error('[infra-rds-health]', err.message);
        res.status(500).json({ error: err.message });
    }
};

exports.getInfraRdsDetail = async (req, res) => {
    const { region, accountId, dbIdentifier } = req.query;
    const userId = req.user?.username;
    if (!region || !accountId || !dbIdentifier)
        return res.status(400).json({ error: 'Missing region, accountId or dbIdentifier' });

    const cacheKey = `infra-rds-detail:${userId}:${accountId}:${region}:${dbIdentifier}`;
    const cached = getCached(cacheKey);
    if (cached) return res.json(cached);

    try {
        const credentials = await resolveCredentials(accountId, userId, region);
        const rds = new RDSClient({ region, credentials });
        const cw = new CloudWatchClient({ region, credentials });

        // ── DB instance details ────────────────────────────────────────────────
        const dbResp = await rds.send(new DescribeDBInstancesCommand({
            DBInstanceIdentifier: dbIdentifier,
        }));
        const db = dbResp.DBInstances?.[0];
        if (!db) return res.status(404).json({ error: 'RDS instance not found' });

        const securityGroups = (db.VpcSecurityGroups || []).map(sg => ({
            id: sg.VpcSecurityGroupId,
            status: sg.Status,
        }));

        // ── CloudWatch metrics (last 5 min) ───────────────────────────────────
        const now = new Date();
        const fiveMinAgo = new Date(now.getTime() - 5 * 60 * 1000);

        const metricsResp = await cw.send(new GetMetricDataCommand({
            StartTime: fiveMinAgo,
            EndTime: now,
            MetricDataQueries: [
                {
                    Id: 'cpu',
                    MetricStat: {
                        Metric: {
                            Namespace: 'AWS/RDS',
                            MetricName: 'CPUUtilization',
                            Dimensions: [{ Name: 'DBInstanceIdentifier', Value: dbIdentifier }],
                        },
                        Period: 300,
                        Stat: 'Average',
                    },
                },
                {
                    Id: 'connections',
                    MetricStat: {
                        Metric: {
                            Namespace: 'AWS/RDS',
                            MetricName: 'DatabaseConnections',
                            Dimensions: [{ Name: 'DBInstanceIdentifier', Value: dbIdentifier }],
                        },
                        Period: 300,
                        Stat: 'Average',
                    },
                },
            ],
        }));

        const pickMetric = (id) => {
            const r = metricsResp.MetricDataResults?.find(m => m.Id === id);
            return r?.Values?.length > 0 ? Math.round(r.Values[0] * 10) / 10 : null;
        };

        // ── Latest DB log files ────────────────────────────────────────────────
        let logFiles = [];
        try {
            const logsResp = await rds.send(new DescribeDBLogFilesCommand({
                DBInstanceIdentifier: dbIdentifier,
                MaxRecords: 5,
            }));
            const files = (logsResp.DescribeDBLogFiles || []).slice(0, 3);

            // Download last portion of each log file
            logFiles = await Promise.all(files.map(async (f) => {
                try {
                    const portion = await rds.send(new DownloadDBLogFilePortionCommand({
                        DBInstanceIdentifier: dbIdentifier,
                        LogFileName: f.LogFileName,
                        NumberOfLines: 10,
                    }));
                    return {
                        fileName: f.LogFileName,
                        size: f.Size,
                        lastWritten: f.LastWritten
                            ? new Date(f.LastWritten).toISOString()
                            : null,
                        lines: (portion.LogFileData || '').trim().split('\n').filter(Boolean).slice(-10),
                    };
                } catch {
                    return {
                        fileName: f.LogFileName,
                        size: f.Size,
                        lastWritten: f.LastWritten
                            ? new Date(f.LastWritten).toISOString()
                            : null,
                        lines: [],
                    };
                }
            }));
        } catch {
            logFiles = [];
        }

        const payload = {
            identifier: db.DBInstanceIdentifier,
            engine: db.Engine,
            engineVersion: db.EngineVersion,
            status: db.DBInstanceStatus,
            instanceClass: db.DBInstanceClass,
            storageGb: db.AllocatedStorage,
            storageType: db.StorageType,
            multiAz: db.MultiAZ,
            publiclyAccessible: db.PubliclyAccessible,
            createdAt: db.InstanceCreateTime?.toISOString() || null,
            endpoint: db.Endpoint?.Address || null,
            port: db.Endpoint?.Port || null,
            vpcId: db.DBSubnetGroup?.VpcId || null,
            subnetGroup: db.DBSubnetGroup?.DBSubnetGroupName || null,
            availabilityZone: db.AvailabilityZone || null,
            securityGroups,
            metrics: {
                cpuUtilization: pickMetric('cpu'),
                dbConnections: pickMetric('connections'),
            },
            logFiles,
            fetchedAt: new Date().toISOString(),
        };

        setCached(cacheKey, payload);
        res.json(payload);
    } catch (err) {
        console.error('[infra-rds-detail]', err.message);
        res.status(500).json({ error: err.message });
    }
};

exports.getInfraAlbHealth = async (req, res) => {
    const { region, accountId } = req.query;
    const userId = req.user?.username;
    if (!region || !accountId) return res.status(400).json({ error: 'Missing region or accountId' });

    const cacheKey = `infra-alb:${userId}:${accountId}:${region}`;
    const cached = getCached(cacheKey);
    if (cached) return res.json(cached);

    try {
        const credentials = await resolveCredentials(accountId, userId, region);
        const elb = new ElasticLoadBalancingV2Client({ region, credentials });

        const lbResp = await elb.send(new DescribeLoadBalancersCommand({}));
        const allLbs = lbResp.LoadBalancers || [];

        const tgResp = await elb.send(new DescribeTargetGroupsCommand({}));
        const allTgs = tgResp.TargetGroups || [];

        const tgHealthPromises = allTgs.map(tg =>
            elb.send(new DescribeTargetHealthCommand({ TargetGroupArn: tg.TargetGroupArn }))
                .then(r => {
                    const targets = r.TargetHealthDescriptions || [];
                    return {
                        name: tg.TargetGroupName,
                        healthy: targets.filter(t => t.TargetHealth?.State === 'healthy').length,
                        total: targets.length,
                        lbArns: tg.LoadBalancerArns || [],
                    };
                })
        );
        const tgHealthResults = await Promise.all(tgHealthPromises);

        const loadBalancers = allLbs.map(lb => ({
            name: lb.LoadBalancerName,
            arn: lb.LoadBalancerArn,
            dns: lb.DNSName,
            scheme: lb.Scheme,
            state: lb.State?.Code,
            type: lb.Type,
            targetGroups: tgHealthResults.filter(tg => tg.lbArns.includes(lb.LoadBalancerArn))
                .map(({ lbArns, ...rest }) => rest),
        }));

        const payload = { loadBalancers, fetchedAt: new Date().toISOString() };
        setCached(cacheKey, payload);
        res.json(payload);
    } catch (err) {
        console.error('[infra-alb-health]', err.message);
        res.status(500).json({ error: err.message });
    }
};

exports.getInfraAlbDetail = async (req, res) => {
    const { region, accountId, albArn } = req.query;
    const userId = req.user?.username;
    if (!region || !accountId || !albArn)
        return res.status(400).json({ error: 'Missing region, accountId or albArn' });

    const cacheKey = `infra-alb-detail:${userId}:${accountId}:${region}:${albArn}`;
    const cached = getCached(cacheKey);
    if (cached) return res.json(cached);

    try {
        const credentials = await resolveCredentials(accountId, userId, region);
        const elb = new ElasticLoadBalancingV2Client({ region, credentials });

        // ── LB base info ───────────────────────────────────────────────────────
        const lbResp = await elb.send(new DescribeLoadBalancersCommand({
            LoadBalancerArns: [albArn],
        }));
        const lb = lbResp.LoadBalancers?.[0];
        if (!lb) return res.status(404).json({ error: 'Load balancer not found' });

        const availabilityZones = (lb.AvailabilityZones || []).map(az => az.ZoneName);

        // ── Attributes (access logs) ───────────────────────────────────────────
        const attrsResp = await elb.send(new DescribeLoadBalancerAttributesCommand({
            LoadBalancerArn: albArn,
        }));
        const attrs = attrsResp.Attributes || [];
        const getAttr = (key) => attrs.find(a => a.Key === key)?.Value;
        const accessLogsEnabled = getAttr('access_logs.s3.enabled') === 'true';
        const accessLogsBucket = getAttr('access_logs.s3.bucket') || null;
        const accessLogsPrefix = getAttr('access_logs.s3.prefix') || null;

        // ── Listeners ──────────────────────────────────────────────────────────
        const listenersResp = await elb.send(new DescribeListenersCommand({
            LoadBalancerArn: albArn,
        }));
        const listeners = (listenersResp.Listeners || []).map(l => {
            const defaultAction = l.DefaultActions?.[0];
            let actionSummary = defaultAction?.Type || '—';
            if (defaultAction?.Type === 'forward' && defaultAction?.TargetGroupArn) {
                const tgArnParts = defaultAction.TargetGroupArn.split(':targetgroup/');
                actionSummary = `forward → ${tgArnParts[1]?.split('/')[0] || defaultAction.TargetGroupArn}`;
            }
            return {
                protocol: l.Protocol,
                port: l.Port,
                sslPolicy: l.SslPolicy || null,
                defaultAction: actionSummary,
            };
        });

        // ── Target groups ──────────────────────────────────────────────────────
        const tgResp = await elb.send(new DescribeTargetGroupsCommand({
            LoadBalancerArn: albArn,
        }));

        const targetGroups = await Promise.all((tgResp.TargetGroups || []).map(async tg => {
            let healthyCount = 0;
            let totalCount = 0;
            try {
                const healthResp = await elb.send(new DescribeTargetHealthCommand({
                    TargetGroupArn: tg.TargetGroupArn,
                }));
                const targets = healthResp.TargetHealthDescriptions || [];
                totalCount = targets.length;
                healthyCount = targets.filter(t => t.TargetHealth?.State === 'healthy').length;
            } catch { /* ignore */ }

            return {
                name: tg.TargetGroupName,
                arn: tg.TargetGroupArn,
                protocol: tg.Protocol || '—',
                port: tg.Port || null,
                targetType: tg.TargetType || '—',
                healthyCount,
                totalCount,
                healthCheckPath: tg.HealthCheckPath || '—',
                healthCheckProtocol: tg.HealthCheckProtocol || '—',
                healthCheckStatus: healthyCount === totalCount && totalCount > 0
                    ? 'healthy'
                    : healthyCount > 0 ? 'degraded' : 'unhealthy',
            };
        }));

        // ── Tags ───────────────────────────────────────────────────────────────
        let tags = [];
        try {
            const tagsResp = await elb.send(new DescribeTagsCommand({
                ResourceArns: [albArn],
            }));
            tags = (tagsResp.TagDescriptions?.[0]?.Tags || []).map(t => ({
                Key: t.Key,
                Value: t.Value,
            }));
        } catch { /* ignore */ }

        const payload = {
            name: lb.LoadBalancerName,
            arn: lb.LoadBalancerArn,
            dns: lb.DNSName,
            scheme: lb.Scheme,
            type: lb.Type,
            state: lb.State?.Code,
            vpcId: lb.VpcId || null,
            createdAt: lb.CreatedTime?.toISOString() || null,
            availabilityZones,
            accessLogs: {
                enabled: accessLogsEnabled,
                bucket: accessLogsBucket,
                prefix: accessLogsPrefix,
            },
            listeners,
            targetGroups,
            tags,
            fetchedAt: new Date().toISOString(),
        };

        setCached(cacheKey, payload);
        res.json(payload);
    } catch (err) {
        console.error('[infra-alb-detail]', err.message);
        res.status(500).json({ error: err.message });
    }
};

exports.getInfraEcsHealth = async (req, res) => {
    const { region, accountId } = req.query;
    const userId = req.user?.username;
    if (!region || !accountId) return res.status(400).json({ error: 'Missing region or accountId' });

    const cacheKey = `infra-ecs:${userId}:${accountId}:${region}`;
    const cached = getCached(cacheKey);
    if (cached) return res.json(cached);

    try {
        const credentials = await resolveCredentials(accountId, userId, region);
        const ecs = new ECSClient({ region, credentials });

        // List all cluster ARNs, then describe them
        const listResp = await ecs.send(new ListClustersCommand({}));
        const clusterArns = listResp.clusterArns || [];

        let clusters = [];
        if (clusterArns.length > 0) {
            const descResp = await ecs.send(new DescribeClustersCommand({ clusters: clusterArns }));
            clusters = (descResp.clusters || []).map(c => ({
                name: c.clusterName,
                arn: c.clusterArn,
                status: c.status,
                runningTasksCount: c.runningTasksCount ?? 0,
                pendingTasksCount: c.pendingTasksCount ?? 0,
                activeServicesCount: c.activeServicesCount ?? 0,
            }));
        }

        const payload = { clusters, fetchedAt: new Date().toISOString() };
        setCached(cacheKey, payload);
        res.json(payload);
    } catch (err) {
        console.error('[infra-ecs-health]', err.message);
        res.status(500).json({ error: err.message });
    }
};

exports.getInfraEcsDetail = async (req, res) => {
    const { region, accountId, clusterArn } = req.query;
    const userId = req.user?.username;
    if (!region || !accountId || !clusterArn)
        return res.status(400).json({ error: 'Missing region, accountId or clusterArn' });

    const cacheKey = `infra-ecs-detail:${userId}:${accountId}:${region}:${clusterArn}`;
    const cached = getCached(cacheKey);
    if (cached) return res.json(cached);

    try {
        const credentials = await resolveCredentials(accountId, userId, region);
        const ecs = new ECSClient({ region, credentials });
        const cw = new CloudWatchClient({ region, credentials });

        // ── Cluster details ────────────────────────────────────────────────────
        const clusterResp = await ecs.send(new DescribeClustersCommand({
            clusters: [clusterArn],
            include: ['TAGS', 'SETTINGS', 'CONFIGURATIONS', 'STATISTICS'],
        }));
        const cluster = clusterResp.clusters?.[0];
        if (!cluster) return res.status(404).json({ error: 'ECS cluster not found' });

        const clusterName = cluster.clusterName;
        const capacityProviders = cluster.capacityProviders || [];
        const tags = (cluster.tags || []).map(t => ({ Key: t.key, Value: t.value }));

        const registeredContainerInstances = cluster.registeredContainerInstancesCount ?? 0;

        // ── Services ───────────────────────────────────────────────────────────
        let services = [];
        try {
            const listSvcResp = await ecs.send(new ListServicesCommand({
                cluster: clusterArn,
                maxResults: 20,
            }));
            if (listSvcResp.serviceArns?.length > 0) {
                const descSvcResp = await ecs.send(new DescribeServicesCommand({
                    cluster: clusterArn,
                    services: listSvcResp.serviceArns,
                }));
                services = (descSvcResp.services || []).map(s => ({
                    name: s.serviceName,
                    taskDefinition: s.taskDefinition?.split('/').pop() || '—',
                    runningCount: s.runningCount,
                    desiredCount: s.desiredCount,
                    launchType: s.launchType || 'FARGATE',
                    status: s.status,
                }));
            }
        } catch { /* ignore */ }

        // ── Running tasks ──────────────────────────────────────────────────────
        let tasks = [];
        try {
            const listTasksResp = await ecs.send(new ListTasksCommand({
                cluster: clusterArn,
                desiredStatus: 'RUNNING',
                maxResults: 20,
            }));
            if (listTasksResp.taskArns?.length > 0) {
                const descTasksResp = await ecs.send(new DescribeTasksCommand({
                    cluster: clusterArn,
                    tasks: listTasksResp.taskArns,
                }));
                tasks = (descTasksResp.tasks || []).map(t => ({
                    taskId: t.taskArn?.split('/').pop() || t.taskArn,
                    taskDefinition: t.taskDefinitionArn?.split('/').pop() || '—',
                    lastStatus: t.lastStatus,
                    startedAt: t.startedAt?.toISOString() || null,
                    cpu: t.cpu || '—',
                    memory: t.memory || '—',
                }));
            }
        } catch { /* ignore */ }

        // ── Recent cluster events ──────────────────────────────────────────────
        // Events come from the first service found (cluster-level events
        // are not directly available; service events are the closest proxy)
        let recentEvents = [];
        try {
            if (services.length > 0) {
                const firstSvcArn = (await ecs.send(new ListServicesCommand({
                    cluster: clusterArn,
                    maxResults: 1,
                }))).serviceArns?.[0];

                if (firstSvcArn) {
                    const evtResp = await ecs.send(new DescribeServicesCommand({
                        cluster: clusterArn,
                        services: [firstSvcArn],
                    }));
                    recentEvents = (evtResp.services?.[0]?.events || [])
                        .slice(0, 5)
                        .map(e => ({
                            message: e.message,
                            createdAt: e.createdAt?.toISOString() || null,
                        }));
                }
            }
        } catch { /* ignore */ }

        // ── CloudWatch metrics (last 5 min) ───────────────────────────────────
        const now = new Date();
        const fiveMinAgo = new Date(now.getTime() - 5 * 60 * 1000);

        const metricsResp = await cw.send(new GetMetricDataCommand({
            StartTime: fiveMinAgo,
            EndTime: now,
            MetricDataQueries: [
                {
                    Id: 'cpu',
                    MetricStat: {
                        Metric: {
                            Namespace: 'ECS/ContainerInsights',
                            MetricName: 'CpuUtilized',
                            Dimensions: [{ Name: 'ClusterName', Value: clusterName }],
                        },
                        Period: 300,
                        Stat: 'Average',
                    },
                },
                {
                    Id: 'cpuReserved',
                    MetricStat: {
                        Metric: {
                            Namespace: 'ECS/ContainerInsights',
                            MetricName: 'CpuReserved',
                            Dimensions: [{ Name: 'ClusterName', Value: clusterName }],
                        },
                        Period: 300,
                        Stat: 'Average',
                    },
                },
                {
                    Id: 'mem',
                    MetricStat: {
                        Metric: {
                            Namespace: 'ECS/ContainerInsights',
                            MetricName: 'MemoryUtilized',
                            Dimensions: [{ Name: 'ClusterName', Value: clusterName }],
                        },
                        Period: 300,
                        Stat: 'Average',
                    },
                },
                {
                    Id: 'memReserved',
                    MetricStat: {
                        Metric: {
                            Namespace: 'ECS/ContainerInsights',
                            MetricName: 'MemoryReserved',
                            Dimensions: [{ Name: 'ClusterName', Value: clusterName }],
                        },
                        Period: 300,
                        Stat: 'Average',
                    },
                },
                {
                    Id: 'runningTasks',
                    MetricStat: {
                        Metric: {
                            Namespace: 'ECS/ContainerInsights',
                            MetricName: 'RunningTaskCount',
                            Dimensions: [{ Name: 'ClusterName', Value: clusterName }],
                        },
                        Period: 300,
                        Stat: 'Average',
                    },
                },
                {
                    Id: 'pendingTasks',
                    MetricStat: {
                        Metric: {
                            Namespace: 'ECS/ContainerInsights',
                            MetricName: 'PendingTaskCount',
                            Dimensions: [{ Name: 'ClusterName', Value: clusterName }],
                        },
                        Period: 300,
                        Stat: 'Average',
                    },
                },
            ],
        }));

        const pickVal = (id) => {
            const r = metricsResp.MetricDataResults?.find(m => m.Id === id);
            return r?.Values?.length > 0 ? Math.round(r.Values[0] * 10) / 10 : null;
        };

        const cpuUsed = pickVal('cpu');
        const cpuReserved = pickVal('cpuReserved');
        const memUsed = pickVal('mem');
        const memReserved = pickVal('memReserved');

        const payload = {
            clusterName,
            clusterArn: cluster.clusterArn,
            status: cluster.status,
            runningTasksCount: cluster.runningTasksCount,
            pendingTasksCount: cluster.pendingTasksCount,
            activeServicesCount: cluster.activeServicesCount,
            registeredContainerInstances,
            capacityProviders,
            services,
            tasks,
            recentEvents,
            tags,
            metrics: {
                cpuUtilization: (cpuUsed !== null && cpuReserved)
                    ? Math.round((cpuUsed / cpuReserved) * 1000) / 10
                    : null,
                memoryUtilization: (memUsed !== null && memReserved)
                    ? Math.round((memUsed / memReserved) * 1000) / 10
                    : null,
                runningTaskCount: pickVal('runningTasks'),
                pendingTaskCount: pickVal('pendingTasks'),
            },
            fetchedAt: new Date().toISOString(),
        };

        setCached(cacheKey, payload);
        res.json(payload);
    } catch (err) {
        console.error('[infra-ecs-detail]', err.message);
        res.status(500).json({ error: err.message });
    }
};