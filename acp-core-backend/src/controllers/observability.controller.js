const db = require('../config/db');
const { STSClient, AssumeRoleCommand } = require('@aws-sdk/client-sts');
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

        // Fan out to all AWS sources in parallel
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

        // Pull the last 5 service events for display
        const recentEvents = (service?.events || []).slice(0, 5).map(e => ({
            message: e.message,
            createdAt: e.createdAt,
        }));

        // Deployment info from the active deployment
        const activeDeployment = (service?.deployments || []).find(d => d.status === 'PRIMARY');

        const status = computeStatus({ service, alarms: alarmsVal, targetGroupHealth: tgHealth });

        const payload = {
            status,
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
        console.error('[observability]', err.message);
        res.status(500).json({ error: err.message });
    }
};

// ── GET /api/v1/observability/deployments-health ──────────────────────────────
// Returns lightweight health status for ALL deployments stored in DB
exports.getAllDeploymentsHealth = async (req, res) => {
    const userId = req.user?.username;

    try {
        const deployments = await deploymentModel.getDeployments();

        // For each deployment that has ECS metadata, fetch health in parallel
        const healthChecks = deployments.map(async (d) => {
            const { id, name, ecsCluster, region, accountID, status: dbStatus } = d;

            if (!ecsCluster || !region || !accountID) {
                return { id, name, status: 'unknown', reason: 'Missing ECS metadata' };
            }

            const cacheKey = `${userId}:${accountID}:${region}:${ecsCluster}:${name}`;
            const cached = getCached(cacheKey);
            if (cached) return { id, name, status: cached.status, metrics: cached.metrics, service: cached.service };

            try {
                const credentials = await resolveCredentials(accountID, userId, region);
                const [ecsService, alarms] = await Promise.allSettled([
                    observabilityService.describeEcsService(credentials, region, ecsCluster, name),
                    observabilityService.getActiveAlarms(credentials, region, ecsCluster),
                ]);

                const service = ecsService.status === 'fulfilled' ? ecsService.value : null;
                const alarmsVal = alarms.status === 'fulfilled' ? alarms.value : [];
                const status = computeStatus({ service, alarms: alarmsVal, targetGroupHealth: null });

                return {
                    id,
                    name,
                    status,
                    service: {
                        runningCount: service?.runningCount ?? 0,
                        desiredCount: service?.desiredCount ?? 0,
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