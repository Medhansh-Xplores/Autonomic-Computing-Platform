export type HealthStatus = 'healthy' | 'degraded' | 'unhealthy' | 'unknown';

export interface ServiceInfo {
    name: string;
    cluster: string;
    region: string;
    runningCount: number;
    desiredCount: number;
    pendingCount: number;
    taskDefinition: string | null;
    createdAt: string | null;
}

export interface DeploymentInfo {
    status: string;
    rolloutState: string;
    rolloutStateReason: string;
    updatedAt: string;
    runningCount: number;
    desiredCount: number;
}

export interface TaskInfo {
    taskArn: string;
    lastStatus: string;
    healthStatus: string;
    cpu: string;
    memory: string;
    startedAt: string | null;
    stoppedReason: string | null;
}

export interface MetricsInfo {
    cpuUtilization: number | null;
    memoryUtilization: number | null;
    cpuReservedUnits?: number;
    memoryReservedMiB?: number;
}

export interface AlarmInfo {
    name: string;
    description: string;
    stateReason: string;
}

export interface TargetGroupHealth {
    targetGroupName: string;
    healthyCount: number;
    totalCount: number;
}

export interface ServiceEvent {
    message: string;
    createdAt: string;
}

export interface ObservabilityHealth {
    status: HealthStatus;
    accountId?: string;
    service: ServiceInfo;
    deployment: DeploymentInfo | null;
    tasks: TaskInfo[];
    metrics: MetricsInfo;
    alarms: AlarmInfo[];
    targetGroupHealth: TargetGroupHealth | null;
    recentEvents: ServiceEvent[];
    fetchedAt: string;
    _mock?: boolean;        // only present in local dev mode
}

export interface DeploymentHealthSummary {
    id: string;
    name: string;
    status: HealthStatus;
    reason?: string;
    service?: {
        runningCount: number;
        desiredCount: number;
    };
    metrics?: MetricsInfo;
}

// ── VPC Health ────────────────────────────────────────────────────────────────
export interface SubnetInfo {
    subnetId: string;
    name: string;
    az: string;
    type: 'public' | 'private';
    cidr: string;
    state: string;
}

export interface VpcInfo {
    vpcId: string;
    name: string;
    cidr: string;
    state: string;
    subnets: SubnetInfo[];
}

export interface VpcHealthPayload {
    vpcs: VpcInfo[];
    fetchedAt: string;
    _mock?: boolean;
}

// ── RDS Health ────────────────────────────────────────────────────────────────
export interface RdsInstance {
    identifier: string;
    engine: string;
    engineVersion: string;
    status: string;
    instanceClass: string;
    multiAz: boolean;
    endpoint: string | null;
    port: number | null;
    storageGb: number;
    createdAt: string | null;
}

export interface RdsHealthPayload {
    instances: RdsInstance[];
    fetchedAt: string;
    _mock?: boolean;
}

// ── ALB Health ────────────────────────────────────────────────────────────────
export interface AlbTargetGroup {
    name: string;
    healthy: number;
    total: number;
}

export interface AlbInfo {
    name: string;
    arn: string;
    dns: string;
    scheme: string;
    state: string;
    type: string;
    targetGroups: AlbTargetGroup[];
}

export interface AlbHealthPayload {
    loadBalancers: AlbInfo[];
    fetchedAt: string;
    _mock?: boolean;
}

// ── ECS Health ────────────────────────────────────────────────────────────────
export interface EcsClusterInfo {
    name: string;
    arn: string;
    status: string;
    runningTasksCount: number;
    pendingTasksCount: number;
    activeServicesCount: number;
}

export interface EcsHealthPayload {
    clusters: EcsClusterInfo[];
    fetchedAt: string;
    _mock?: boolean;
}