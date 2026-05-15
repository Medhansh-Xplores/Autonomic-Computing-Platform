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
