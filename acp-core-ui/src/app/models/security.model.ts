export type CheckStatus = 'pass' | 'fail' | 'warn';

export interface SecurityCheck {
    id: string;
    label: string;
    status: CheckStatus;
}

export interface SecurityOverall {
    score: number;
    status: 'healthy' | 'degraded' | 'unhealthy' | 'unknown';
    passed: number;
    failed: number;
    total: number;
}

export interface TaskDefinitionSecurity {
    name: string | null;
    privileged: boolean;
    readonlyRootFilesystem: boolean;
    nonRootUser: boolean;
    logDriverConfigured: boolean;
    secretsFromSecretsManager: boolean;
    checks: SecurityCheck[];
}

export interface IamRoleSecurity {
    roleArn: string;
    roleName: string;
    lastUsed: string | null;
    attachedPolicies: string[];
    wildcardResourceFound: boolean;
    checks: SecurityCheck[];
}

export interface SecretSecurity {
    name: string;
    rotationEnabled: boolean;
    lastRotatedDays: number | null;
    status: CheckStatus;
}

export interface SecurityGroupInfo {
    groupId: string;
    groupName: string;
    publicIngressRules: number;
    totalIngressRules: number;
    checks: SecurityCheck[];
}

export interface FlowLogSecurity {
    enabled: boolean;
    trafficType?: string;
    destination?: string;
    status: CheckStatus;
}

export interface AlbSecurity {
    httpsOnly: boolean;
    httpRedirectPresent: boolean;
    tlsPolicy: string | null;
    modernTls: boolean;
    wafAttached: boolean;
    accessLogsEnabled: boolean;
    checks: SecurityCheck[];
}

export interface RdsSecurity {
    publiclyAccessible: boolean;
    storageEncrypted: boolean;
    deletionProtection: boolean;
    backupRetentionDays: number;
    checks: SecurityCheck[];
}

export interface GuardDutyFinding {
    id: string;
    type: string;
    severity: 'HIGH' | 'MEDIUM';
    title: string;
    updatedAt: string;
}

export interface GuardDutySecurity {
    detectorEnabled: boolean;
    highSeverityFindings?: number;
    mediumSeverityFindings?: number;
    findings?: GuardDutyFinding[];
    checks: SecurityCheck[];
}

export interface CloudTrailSecurity {
    trailEnabled: boolean;
    multiRegion: boolean;
    logValidation: boolean;
    cwLogsArn: string | null;
    checks: SecurityCheck[];
}

export interface CertificateSecurity {
    domain: string;
    arn: string;
    status: string;
    type: string;
    renewalStatus: string;
    expiresAt: string | null;
    daysUntilExpiry: number | null;
    domainValidationMethod: string | null;
    checks: SecurityCheck[];
}

export interface AcpSecurityPosture {
    fetchedAt: string;
    overall: SecurityOverall;
    taskDefinition: TaskDefinitionSecurity | null;
    iamRole: IamRoleSecurity | null;
    secrets: SecretSecurity[];
    network: {
        securityGroups: SecurityGroupInfo[];
        flowLogs: FlowLogSecurity;
        alb: AlbSecurity | null;
        rds: RdsSecurity | null;
    };
    guardDuty: GuardDutySecurity;
    cloudTrail: CloudTrailSecurity | null;
    certificates: CertificateSecurity[];
    _mock?: boolean;
}

// ── Infra & App Deployment Security models ────────────────────────────────────

export interface VpcSecurityResult {
    vpcId: string;
    name: string;
    cidr: string;
    state: string;
    flowLogs: { enabled: boolean; trafficType?: string; destination?: string };
    openSecurityGroups: { groupId: string; groupName: string }[];
    checks: SecurityCheck[];
    overall: SecurityOverall;
}

export interface VpcSecurityPayload {
    vpcs: VpcSecurityResult[];
    overall: SecurityOverall;
    fetchedAt: string;
}

export interface RdsSecurityInstance {
    identifier: string;
    engine: string;
    engineVersion: string;
    status: string;
    publiclyAccessible: boolean;
    storageEncrypted: boolean;
    deletionProtection: boolean;
    backupRetentionDays: number;
    multiAz: boolean;
    checks: SecurityCheck[];
    overall: SecurityOverall;
}

export interface RdsSecurityPayload {
    instances: RdsSecurityInstance[];
    overall: SecurityOverall;
    fetchedAt: string;
}

export interface AlbSecurityResult {
    name: string;
    arn: string;
    dns: string;
    scheme: string;
    state: string;
    httpsOnly: boolean;
    httpRedirectPresent: boolean;
    tlsPolicy: string | null;
    modernTls: boolean;
    wafAttached: boolean;
    accessLogsEnabled: boolean;
    checks: SecurityCheck[];
    overall: SecurityOverall;
}

export interface AlbSecurityPayload {
    loadBalancers: AlbSecurityResult[];
    overall: SecurityOverall;
    fetchedAt: string;
}

export interface EcsServiceSecurity {
    name: string;
    taskDefinition: string | null;
    taskRoleArn: string | null;
    runningCount: number;
    desiredCount: number;
    taskDefinitionChecks: SecurityCheck[];
    iamChecks: SecurityCheck[];
    overall: SecurityOverall;
}

export interface EcsClusterSecurity {
    clusterName: string;
    clusterArn: string;
    status: string;
    services: EcsServiceSecurity[];
    overall: SecurityOverall;
}

export interface EcsSecurityPayload {
    clusters: EcsClusterSecurity[];
    overall: SecurityOverall;
    fetchedAt: string;
}
