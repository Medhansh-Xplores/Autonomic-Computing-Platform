const {
    EC2Client,
    DescribeSecurityGroupsCommand,
    DescribeFlowLogsCommand,
    DescribeSubnetsCommand,         // FIX 1: added to resolve subnet → VPC ID
} = require('@aws-sdk/client-ec2');

const {
    ECSClient,
    DescribeServicesCommand,
    DescribeTaskDefinitionCommand,
    ListTasksCommand,
    DescribeTasksCommand,
} = require('@aws-sdk/client-ecs');

const {
    ElasticLoadBalancingV2Client,
    DescribeLoadBalancersCommand,
    DescribeListenersCommand,
    DescribeLoadBalancerAttributesCommand,
} = require('@aws-sdk/client-elastic-load-balancing-v2');

const {
    IAMClient,
    GetRoleCommand,
    ListAttachedRolePoliciesCommand,
    ListRolePoliciesCommand,
    GetRolePolicyCommand,
} = require('@aws-sdk/client-iam');

const {
    SecretsManagerClient,
    DescribeSecretCommand,
} = require('@aws-sdk/client-secrets-manager');

const {
    ACMClient,
    ListCertificatesCommand,
    DescribeCertificateCommand,
} = require('@aws-sdk/client-acm');

const {
    CloudTrailClient,
    DescribeTrailsCommand,
    GetTrailStatusCommand,
} = require('@aws-sdk/client-cloudtrail');

const {
    GuardDutyClient,
    ListDetectorsCommand,
    ListFindingsCommand,
    GetFindingsCommand,
} = require('@aws-sdk/client-guardduty');

const {
    WAFV2Client,
    GetWebACLForResourceCommand,
} = require('@aws-sdk/client-wafv2');

// FIX 2: RDS client imported at top level (not inline inside try block)
const {
    RDSClient,
    DescribeDBInstancesCommand,
} = require('@aws-sdk/client-rds');

const ACP_REGION = 'us-east-1';
const ACP_CLUSTER = 'acp-cluster';
const ACP_BACKEND_SERVICE = 'acp-backend-service';
const ACP_FRONTEND_SERVICE = 'acp-frontend-service';
const IS_LOCAL = process.env.NODE_ENV !== 'production';

// ── In-memory cache (60 s TTL — security data is less real-time sensitive) ───
const cache = new Map();
const CACHE_TTL_MS = 60 * 1000;

function getCached(key) {
    const entry = cache.get(key);
    if (!entry) return null;
    if (Date.now() - entry.ts > CACHE_TTL_MS) { cache.delete(key); return null; }
    return entry.data;
}
function setCached(key, data) {
    cache.set(key, { ts: Date.now(), data });
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function computeOverallScore(checks) {
    const total = checks.length;
    if (!total) return { score: 0, status: 'unknown' };
    const passed = checks.filter(c => c.status === 'pass').length;
    const failed = checks.filter(c => c.status === 'fail').length;
    const score = Math.round((passed / total) * 100);
    let status = 'healthy';
    if (failed > 0 && failed <= 2) status = 'degraded';
    if (failed > 2) status = 'unhealthy';
    return { score, status, passed, failed, total };
}

// Extract role name from ARN  e.g. arn:aws:iam::377122171982:role/ecsTaskRole → ecsTaskRole
function roleNameFromArn(arn) {
    if (!arn) return null;
    return arn.split('/').pop();
}

// Check if a policy document string contains wildcard resource
function hasWildcardResource(policyDoc) {
    try {
        const doc = JSON.parse(decodeURIComponent(policyDoc));
        return (doc.Statement || []).some(s =>
            s.Effect === 'Allow' && (s.Resource === '*' || (Array.isArray(s.Resource) && s.Resource.includes('*')))
        );
    } catch { return false; }
}

// ── Mock payload for local dev ────────────────────────────────────────────────
const MOCK_PAYLOAD = {
    _mock: true,
    fetchedAt: new Date().toISOString(),
    overall: { score: 74, status: 'degraded', passed: 14, failed: 5, total: 19 },

    taskDefinition: {
        name: 'acp-backend:42',
        privileged: false,
        readonlyRootFilesystem: true,
        nonRootUser: true,
        logDriverConfigured: true,
        secretsFromSecretsManager: true,
        checks: [
            { id: 'td_privileged', label: 'Privileged mode disabled', status: 'pass' },
            { id: 'td_readonly_fs', label: 'Read-only root filesystem', status: 'pass' },
            { id: 'td_non_root', label: 'Non-root container user', status: 'pass' },
            { id: 'td_log_driver', label: 'Log driver configured', status: 'pass' },
            { id: 'td_no_plain_secrets', label: 'No plain-text secrets in env vars', status: 'pass' },
        ],
    },

    iamRole: {
        roleArn: 'arn:aws:iam::377122171982:role/acp-ecs-task-role',
        roleName: 'acp-ecs-task-role',
        lastUsed: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
        attachedPolicies: ['AmazonECSTaskExecutionRolePolicy', 'AcpCustomPolicy'],
        wildcardResourceFound: false,
        checks: [
            { id: 'iam_last_used', label: 'Role recently used (active)', status: 'pass' },
            { id: 'iam_no_wildcard', label: 'No wildcard resource (*) permissions', status: 'pass' },
        ],
    },

    secrets: [
        { name: 'acp/db-password', rotationEnabled: true, lastRotatedDays: 12, status: 'pass' },
        { name: 'acp/jwt-secret', rotationEnabled: false, lastRotatedDays: 95, status: 'fail' },
    ],

    network: {
        securityGroups: [
            {
                groupId: 'sg-0abc1234',
                groupName: 'acp-ecs-sg',
                publicIngressRules: 0,
                totalIngressRules: 2,
                checks: [{ id: 'sg_no_public', label: 'No inbound 0.0.0.0/0 rules', status: 'pass' }],
            },
        ],
        flowLogs: {
            enabled: true,
            trafficType: 'ALL',
            destination: 'cloud-watch-logs',
            status: 'pass',
        },
        alb: {
            httpsOnly: true,
            httpRedirectPresent: true,
            tlsPolicy: 'ELBSecurityPolicy-TLS13-1-2-2021-06',
            wafAttached: false,
            accessLogsEnabled: false,
            checks: [
                { id: 'alb_https', label: 'HTTPS listener enforced', status: 'pass' },
                { id: 'alb_redirect', label: 'HTTP → HTTPS redirect', status: 'pass' },
                { id: 'alb_tls_policy', label: 'Modern TLS policy (TLS 1.3)', status: 'pass' },
                { id: 'alb_waf', label: 'WAF ACL attached', status: 'fail' },
                { id: 'alb_access_logs', label: 'Access logs enabled', status: 'fail' },
            ],
        },
        rds: {
            publiclyAccessible: false,
            storageEncrypted: true,
            deletionProtection: true,
            backupRetentionDays: 7,
            checks: [
                { id: 'rds_not_public', label: 'RDS not publicly accessible', status: 'pass' },
                { id: 'rds_encrypted', label: 'Storage encrypted at rest', status: 'pass' },
                { id: 'rds_deletion', label: 'Deletion protection enabled', status: 'pass' },
                { id: 'rds_backup', label: 'Backup retention ≥ 7 days', status: 'pass' },
            ],
        },
    },

    guardDuty: {
        detectorEnabled: true,
        highSeverityFindings: 0,
        mediumSeverityFindings: 1,
        findings: [
            { id: 'gd-1', type: 'UnauthorizedAccess:EC2/SSHBruteForce', severity: 'MEDIUM', title: 'SSH brute force attempt detected', updatedAt: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString() },
        ],
        checks: [
            { id: 'gd_enabled', label: 'GuardDuty detector enabled', status: 'pass' },
            { id: 'gd_no_high', label: 'No HIGH severity findings', status: 'pass' },
        ],
    },

    cloudTrail: {
        trailEnabled: true,
        multiRegion: true,
        logValidation: true,
        cwLogsArn: 'arn:aws:logs:us-east-1:377122171982:log-group:CloudTrail',
        checks: [
            { id: 'ct_enabled', label: 'CloudTrail trail active', status: 'pass' },
            { id: 'ct_multi_region', label: 'Multi-region trail', status: 'pass' },
            { id: 'ct_log_validation', label: 'Log file integrity validation', status: 'pass' },
            { id: 'ct_cw_logs', label: 'Delivery to CloudWatch Logs', status: 'pass' },
        ],
    },

    certificates: [
        {
            domain: '*.acpportal.example.com',
            arn: 'arn:aws:acm:us-east-1:377122171982:certificate/mock-cert-id',
            status: 'ISSUED',
            type: 'AMAZON_ISSUED',
            renewalStatus: 'SUCCESS',
            expiresAt: new Date(Date.now() + 62 * 24 * 60 * 60 * 1000).toISOString(),
            daysUntilExpiry: 62,
            domainValidationMethod: 'DNS',
            checks: [
                { id: 'cert_expiry', label: 'Certificate valid > 30 days', status: 'pass' },
                { id: 'cert_renew', label: 'Auto-renewal configured', status: 'pass' },
            ],
        },
    ],
};

// ── Main controller ───────────────────────────────────────────────────────────

exports.getAcpSecurityPosture = async (req, res) => {
    const region = req.query.region || ACP_REGION;
    const cluster = req.query.cluster || ACP_CLUSTER;

    if (IS_LOCAL) {
        return res.json(MOCK_PAYLOAD);
    }

    const cacheKey = `acp-security:${region}:${cluster}`;
    const cached = getCached(cacheKey);
    if (cached) return res.json(cached);

    try {
        const ec2 = new EC2Client({ region });
        const ecs = new ECSClient({ region });
        const elb = new ElasticLoadBalancingV2Client({ region });
        const iam = new IAMClient({ region: 'us-east-1' }); // IAM is global
        const sm = new SecretsManagerClient({ region });
        const acm = new ACMClient({ region });
        const ct = new CloudTrailClient({ region });
        const gd = new GuardDutyClient({ region });
        const rds = new RDSClient({ region });              // FIX 2: instantiated at top with other clients
        const wafv2 = new WAFV2Client({ region });            // FIX 3: removed custom endpoint (not needed, causes issues)

        // ── 1. ECS: task definition details ──────────────────────────────────
        const [backendSvcResp] = await Promise.allSettled([
            ecs.send(new DescribeServicesCommand({ cluster, services: [ACP_BACKEND_SERVICE] })),
            ecs.send(new DescribeServicesCommand({ cluster, services: [ACP_FRONTEND_SERVICE] })),
        ]);

        const backendSvc = backendSvcResp.status === 'fulfilled' ? backendSvcResp.value?.services?.[0] : null;
        const taskDefArn = backendSvc?.taskDefinition;

        let taskDefResult = null;
        if (taskDefArn) {
            const tdResp = await ecs.send(new DescribeTaskDefinitionCommand({ taskDefinition: taskDefArn }));
            const td = tdResp.taskDefinition;
            const containers = td?.containerDefinitions || [];

            const privileged = containers.some(c => c.privileged === true);
            const readonlyRootFs = containers.every(c => c.readonlyRootFilesystem === true);
            const nonRootUser = containers.every(c => c.user && c.user !== 'root' && c.user !== '0');
            const logDriverConfigured = containers.every(c => !!c.logConfiguration?.logDriver);
            const hasPlainSecrets = containers.some(c =>
                (c.environment || []).some(e => /secret|password|key|token/i.test(e.name))
            );
            const secretsFromSm = containers.some(c => (c.secrets || []).length > 0);

            // Fetch actual secrets referenced in task def for rotation check
            const allSecretArns = containers.flatMap(c => (c.secrets || []).map(s => s.valueFrom));
            const secretChecks = await Promise.allSettled(
                allSecretArns.slice(0, 10).map(arn =>
                    sm.send(new DescribeSecretCommand({ SecretId: arn }))
                        .then(r => ({
                            name: r.Name,
                            rotationEnabled: r.RotationEnabled || false,
                            lastRotatedDays: r.LastRotatedDate
                                ? Math.floor((Date.now() - new Date(r.LastRotatedDate).getTime()) / 86400000)
                                : null,
                        }))
                )
            );
            const secrets = secretChecks
                .filter(r => r.status === 'fulfilled')
                .map(r => ({
                    ...r.value,
                    status: r.value.rotationEnabled && (r.value.lastRotatedDays === null || r.value.lastRotatedDays < 90) ? 'pass' : 'fail',
                }));

            const taskRoleArn = td?.taskRoleArn || backendSvc?.taskRoleArn;
            const taskRoleName = roleNameFromArn(taskRoleArn);

            // IAM role checks
            let iamResult = null;
            if (taskRoleName) {
                const [roleResp, attachedResp, inlineResp] = await Promise.allSettled([
                    iam.send(new GetRoleCommand({ RoleName: taskRoleName })),
                    iam.send(new ListAttachedRolePoliciesCommand({ RoleName: taskRoleName })),
                    iam.send(new ListRolePoliciesCommand({ RoleName: taskRoleName })),
                ]);

                const role = roleResp.status === 'fulfilled' ? roleResp.value?.Role : null;
                const attachedPolicies = attachedResp.status === 'fulfilled'
                    ? (attachedResp.value?.AttachedPolicies || []).map(p => p.PolicyName)
                    : [];
                const inlinePolicyNames = inlineResp.status === 'fulfilled'
                    ? (inlineResp.value?.PolicyNames || [])
                    : [];

                // Check inline policies for wildcard resource
                const inlinePoliciesResp = await Promise.allSettled(
                    inlinePolicyNames.map(pn =>
                        iam.send(new GetRolePolicyCommand({ RoleName: taskRoleName, PolicyName: pn }))
                    )
                );
                const wildcardFound = inlinePoliciesResp.some(r =>
                    r.status === 'fulfilled' && hasWildcardResource(r.value?.PolicyDocument)
                );

                const lastUsed = role?.RoleLastUsed?.LastUsedDate?.toISOString() || null;
                const lastUsedDays = lastUsed
                    ? Math.floor((Date.now() - new Date(lastUsed).getTime()) / 86400000)
                    : null;

                iamResult = {
                    roleArn: taskRoleArn,
                    roleName: taskRoleName,
                    lastUsed,
                    attachedPolicies,
                    wildcardResourceFound: wildcardFound,
                    checks: [
                        { id: 'iam_last_used', label: 'Role recently used (active)', status: lastUsedDays !== null && lastUsedDays < 30 ? 'pass' : 'warn' },
                        { id: 'iam_no_wildcard', label: 'No wildcard resource (*) permissions', status: wildcardFound ? 'fail' : 'pass' },
                    ],
                };
            }

            taskDefResult = {
                name: taskDefArn?.split('/').pop(),
                privileged,
                readonlyRootFilesystem: readonlyRootFs,
                nonRootUser,
                logDriverConfigured,
                secretsFromSecretsManager: secretsFromSm,
                checks: [
                    { id: 'td_privileged', label: 'Privileged mode disabled', status: !privileged ? 'pass' : 'fail' },
                    { id: 'td_readonly_fs', label: 'Read-only root filesystem', status: readonlyRootFs ? 'pass' : 'fail' },
                    { id: 'td_non_root', label: 'Non-root container user', status: nonRootUser ? 'pass' : 'fail' },
                    { id: 'td_log_driver', label: 'Log driver configured', status: logDriverConfigured ? 'pass' : 'fail' },
                    { id: 'td_no_plain_secrets', label: 'No plain-text secrets in env vars', status: !hasPlainSecrets ? 'pass' : 'fail' },
                ],
            };

            // Attach to outer scope temporarily
            taskDefResult._secrets = secrets;
            taskDefResult._iamResult = iamResult;
        }

        // ── 2. Network: SG rules ──────────────────────────────────────────────
        const sgIds = (backendSvc?.networkConfiguration?.awsvpcConfiguration?.securityGroups || []);
        let sgResults = [];
        if (sgIds.length) {
            const sgResp = await ec2.send(new DescribeSecurityGroupsCommand({ GroupIds: sgIds }));
            sgResults = (sgResp.SecurityGroups || []).map(sg => {
                const publicRules = (sg.IpPermissions || []).filter(rule =>
                    (rule.IpRanges || []).some(r => r.CidrIp === '0.0.0.0/0') ||
                    (rule.Ipv6Ranges || []).some(r => r.CidrIpv6 === '::/0')
                );
                return {
                    groupId: sg.GroupId,
                    groupName: sg.GroupName,
                    publicIngressRules: publicRules.length,
                    totalIngressRules: (sg.IpPermissions || []).length,
                    checks: [
                        { id: 'sg_no_public', label: 'No inbound 0.0.0.0/0 rules', status: publicRules.length === 0 ? 'pass' : 'fail' },
                    ],
                };
            });
        }

        // ── 3. VPC flow logs ──────────────────────────────────────────────────
        // FIX 1: get the real VPC ID by describing the subnet first.
        // The ECS networkConfiguration only gives us subnet IDs, not the VPC ID.
        // DescribeFlowLogs filters on resource-id which must be a vpc-* ID.
        let flowLogResult = { enabled: false, status: 'fail' };
        const subnetId = backendSvc?.networkConfiguration?.awsvpcConfiguration?.subnets?.[0];
        if (subnetId) {
            try {
                const subnetResp = await ec2.send(new DescribeSubnetsCommand({ SubnetIds: [subnetId] }));
                const realVpcId = subnetResp.Subnets?.[0]?.VpcId;
                if (realVpcId) {
                    const flResp = await ec2.send(new DescribeFlowLogsCommand({
                        Filters: [{ Name: 'resource-id', Values: [realVpcId] }],
                    }));
                    const fl = (flResp.FlowLogs || [])[0];
                    if (fl) {
                        flowLogResult = {
                            enabled: true,
                            trafficType: fl.TrafficType,
                            destination: fl.LogDestinationType,
                            logStatus: fl.FlowLogStatus,
                            status: fl.FlowLogStatus === 'ACTIVE' && fl.TrafficType === 'ALL' ? 'pass' : 'warn',
                        };
                    }
                }
            } catch { /* flow log lookup failed — leave as fail */ }
        }

        // ── 4. ALB security checks ────────────────────────────────────────────
        const lbResp = await elb.send(new DescribeLoadBalancersCommand({}));
        const acpAlb = (lbResp.LoadBalancers || []).find(lb => lb.LoadBalancerName.toLowerCase().startsWith('acp-'));
        let albResult = null;
        if (acpAlb) {
            const [listenersResp, attrsResp] = await Promise.allSettled([
                elb.send(new DescribeListenersCommand({ LoadBalancerArn: acpAlb.LoadBalancerArn })),
                elb.send(new DescribeLoadBalancerAttributesCommand({ LoadBalancerArn: acpAlb.LoadBalancerArn })),
            ]);

            const listeners = listenersResp.status === 'fulfilled' ? (listenersResp.value?.Listeners || []) : [];
            const attrs = attrsResp.status === 'fulfilled'
                ? Object.fromEntries((attrsResp.value?.Attributes || []).map(a => [a.Key, a.Value]))
                : {};

            const httpsListener = listeners.find(l => l.Protocol === 'HTTPS');
            const httpListener = listeners.find(l => l.Protocol === 'HTTP');
            const tlsPolicy = httpsListener?.SslPolicy || null;
            const modernTls = tlsPolicy?.includes('TLS13') || tlsPolicy?.includes('2021') || false;
            const httpRedirect = (httpListener?.DefaultActions || []).some(a =>
                a.Type === 'redirect' && a.RedirectConfig?.Protocol === 'HTTPS'
            );
            const accessLogsOn = attrs['access_logs.s3.enabled'] === 'true';

            // FIX 3: WAF check — Scope: 'REGIONAL' is required for ALB-associated WebACLs
            let wafAttached = false;
            try {
                const wafResp = await wafv2.send(new GetWebACLForResourceCommand({
                    ResourceArn: acpAlb.LoadBalancerArn,
                    Scope: 'REGIONAL',
                }));
                wafAttached = !!wafResp.WebACL;
            } catch { /* WAF not attached or not configured */ }

            albResult = {
                httpsOnly: !!httpsListener,
                httpRedirectPresent: httpRedirect,
                tlsPolicy,
                modernTls,
                wafAttached,
                accessLogsEnabled: accessLogsOn,
                checks: [
                    { id: 'alb_https', label: 'HTTPS listener enforced', status: httpsListener ? 'pass' : 'fail' },
                    { id: 'alb_redirect', label: 'HTTP → HTTPS redirect', status: httpRedirect ? 'pass' : 'fail' },
                    { id: 'alb_tls_policy', label: 'Modern TLS policy (TLS 1.3)', status: modernTls ? 'pass' : 'warn' },
                    { id: 'alb_waf', label: 'WAF ACL attached', status: wafAttached ? 'pass' : 'fail' },
                    { id: 'alb_access_logs', label: 'Access logs enabled', status: accessLogsOn ? 'pass' : 'fail' },
                ],
            };
        }

        // ── 5. RDS security checks ────────────────────────────────────────────
        // FIX 2: removed wildcard filter ('acp-*') — AWS SDK does not support
        // wildcard values in db-instance-id filter; fetch all and find by prefix.
        let rdsResult = null;
        try {
            const rdsResp = await rds.send(new DescribeDBInstancesCommand({}));
            const db = (rdsResp.DBInstances || []).find(i =>
                i.DBInstanceIdentifier.startsWith('acp-')
            );
            if (db) {
                rdsResult = {
                    publiclyAccessible: db.PubliclyAccessible,
                    storageEncrypted: db.StorageEncrypted,
                    deletionProtection: db.DeletionProtection,
                    backupRetentionDays: db.BackupRetentionPeriod,
                    checks: [
                        { id: 'rds_not_public', label: 'RDS not publicly accessible', status: !db.PubliclyAccessible ? 'pass' : 'fail' },
                        { id: 'rds_encrypted', label: 'Storage encrypted at rest', status: db.StorageEncrypted ? 'pass' : 'fail' },
                        { id: 'rds_deletion', label: 'Deletion protection enabled', status: db.DeletionProtection ? 'pass' : 'fail' },
                        { id: 'rds_backup', label: 'Backup retention ≥ 7 days', status: (db.BackupRetentionPeriod || 0) >= 7 ? 'pass' : 'fail' },
                    ],
                };
            }
        } catch { /* RDS might not exist */ }

        // ── 6. GuardDuty ─────────────────────────────────────────────────────
        let gdResult = { detectorEnabled: false, checks: [{ id: 'gd_enabled', label: 'GuardDuty detector enabled', status: 'fail' }] };
        try {
            const detectors = await gd.send(new ListDetectorsCommand({}));
            const detectorId = detectors.DetectorIds?.[0];
            if (detectorId) {
                const findings = await gd.send(new ListFindingsCommand({
                    DetectorId: detectorId,
                    FindingCriteria: {
                        Criterion: {
                            'severity': { Gte: 4 },   // 4+ = MEDIUM; 7+ = HIGH
                            'updatedAt': { Gte: Date.now() - 7 * 24 * 60 * 60 * 1000 },
                        },
                    },
                    MaxResults: 10,
                }));

                let findingDetails = [];
                if ((findings.FindingIds || []).length > 0) {
                    const detailResp = await gd.send(new GetFindingsCommand({
                        DetectorId: detectorId,
                        FindingIds: findings.FindingIds,
                    }));
                    findingDetails = (detailResp.Findings || []).map(f => ({
                        id: f.Id,
                        type: f.Type,
                        severity: f.Severity >= 7 ? 'HIGH' : 'MEDIUM',
                        title: f.Title,
                        updatedAt: f.UpdatedAt,
                    }));
                }

                const highCount = findingDetails.filter(f => f.severity === 'HIGH').length;
                const mediumCount = findingDetails.filter(f => f.severity === 'MEDIUM').length;

                gdResult = {
                    detectorEnabled: true,
                    highSeverityFindings: highCount,
                    mediumSeverityFindings: mediumCount,
                    findings: findingDetails,
                    checks: [
                        { id: 'gd_enabled', label: 'GuardDuty detector enabled', status: 'pass' },
                        { id: 'gd_no_high', label: 'No HIGH severity findings', status: highCount === 0 ? 'pass' : 'fail' },
                    ],
                };
            }
        } catch { /* GuardDuty not enabled */ }

        // ── 7. CloudTrail ─────────────────────────────────────────────────────
        let ctResult = null;
        try {
            const trailsResp = await ct.send(new DescribeTrailsCommand({ includeShadowTrails: false }));
            const trail = (trailsResp.trailList || [])[0];
            if (trail) {
                const statusResp = await ct.send(new GetTrailStatusCommand({ Name: trail.TrailARN }));
                ctResult = {
                    trailEnabled: statusResp.IsLogging || false,
                    multiRegion: trail.IsMultiRegionTrail || false,
                    logValidation: trail.LogFileValidationEnabled || false,
                    cwLogsArn: trail.CloudWatchLogsLogGroupArn || null,
                    checks: [
                        { id: 'ct_enabled', label: 'CloudTrail trail active', status: statusResp.IsLogging ? 'pass' : 'fail' },
                        { id: 'ct_multi_region', label: 'Multi-region trail', status: trail.IsMultiRegionTrail ? 'pass' : 'warn' },
                        { id: 'ct_log_validation', label: 'Log file integrity validation', status: trail.LogFileValidationEnabled ? 'pass' : 'fail' },
                        { id: 'ct_cw_logs', label: 'Delivery to CloudWatch Logs', status: trail.CloudWatchLogsLogGroupArn ? 'pass' : 'warn' },
                    ],
                };
            }
        } catch { /* CloudTrail might not be configured */ }

        // ── 8. ACM certificates ───────────────────────────────────────────────
        let certificates = [];
        try {
            const certList = await acm.send(new ListCertificatesCommand({ CertificateStatuses: ['ISSUED'] }));
            const certDetails = await Promise.allSettled(
                (certList.CertificateSummaryList || []).slice(0, 5).map(c =>
                    acm.send(new DescribeCertificateCommand({ CertificateArn: c.CertificateArn }))
                )
            );
            certificates = certDetails
                .filter(r => r.status === 'fulfilled')
                .map(r => {
                    const c = r.value.Certificate;
                    const expiresAt = c.NotAfter;
                    const daysUntilExpiry = expiresAt
                        ? Math.floor((new Date(expiresAt).getTime() - Date.now()) / 86400000)
                        : null;
                    return {
                        domain: c.DomainName,
                        arn: c.CertificateArn,
                        status: c.Status,
                        type: c.Type,
                        renewalStatus: c.RenewalEligibility,
                        expiresAt: expiresAt?.toISOString() || null,
                        daysUntilExpiry,
                        domainValidationMethod: (c.DomainValidationOptions?.[0]?.ValidationMethod) || null,
                        checks: [
                            { id: 'cert_expiry', label: 'Certificate valid > 30 days', status: daysUntilExpiry !== null && daysUntilExpiry > 30 ? 'pass' : 'fail' },
                            { id: 'cert_renew', label: 'Auto-renewal configured', status: c.RenewalEligibility === 'ELIGIBLE' || c.Type === 'AMAZON_ISSUED' ? 'pass' : 'warn' },
                        ],
                    };
                });
        } catch { /* ACM error */ }

        // ── Assemble final payload ────────────────────────────────────────────
        const allChecks = [
            ...(taskDefResult?.checks || []),
            ...(taskDefResult?._iamResult?.checks || []),
            ...(taskDefResult?._secrets || []).map(s => ({ id: `secret_${s.name}`, label: `Secret rotation: ${s.name}`, status: s.status })),
            ...sgResults.flatMap(sg => sg.checks),
            flowLogResult.status !== undefined ? [{ id: 'flow_logs', label: 'VPC flow logs enabled', status: flowLogResult.status }] : [],
            ...(albResult?.checks || []),
            ...(rdsResult?.checks || []),
            ...(gdResult?.checks || []),
            ...(ctResult?.checks || []),
            ...certificates.flatMap(c => c.checks),
        ].flat();

        const iamResult = taskDefResult?._iamResult || null;
        const secrets = taskDefResult?._secrets || [];
        delete taskDefResult?._iamResult;
        delete taskDefResult?._secrets;

        const payload = {
            fetchedAt: new Date().toISOString(),
            overall: computeOverallScore(allChecks),
            taskDefinition: taskDefResult,
            iamRole: iamResult,
            secrets,
            network: {
                securityGroups: sgResults,
                flowLogs: flowLogResult,
                alb: albResult,
                rds: rdsResult,
            },
            guardDuty: gdResult,
            cloudTrail: ctResult,
            certificates,
        };

        setCached(cacheKey, payload);
        res.json(payload);

    } catch (err) {
        console.error('[acp-security]', err.message);
        res.status(500).json({ error: err.message });
    }
};
