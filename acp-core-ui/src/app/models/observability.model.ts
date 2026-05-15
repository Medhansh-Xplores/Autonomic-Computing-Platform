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

// ── VPC Detail (full drill-down) ──────────────────────────────────────────────
export interface SubnetDetailInfo {
    subnetId: string;
    name: string;
    az: string;
    type: 'public' | 'private';
    cidr: string;
    availableIps: number;
    state: string;
}

export interface FlowLogInfo {
    flowLogId: string;
    status: string;
    trafficType: string;
    destination: string;
    deliverStatus: string;
    createdAt: string | null;
}

export interface VpcDetailPayload {
    vpcId: string;
    name: string;
    cidr: string;
    state: string;
    region: string;
    dnsHostnames: boolean;
    dnsResolution: boolean;
    tenancy: string;
    subnets: SubnetDetailInfo[];
    routeTableCount: number;
    internetGatewayAttached: boolean;
    natGatewayCount: number;
    securityGroupCount: number;
    flowLogs: FlowLogInfo[];
    tags: { Key: string; Value: string }[];
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

// ── RDS Detail ────────────────────────────────────────────────────────────────
export interface RdsSecurityGroup {
    id: string;
    status: string;
}

export interface RdsLogFile {
    fileName: string;
    size: number;
    lastWritten: string | null;
    lines: string[];
}

export interface RdsDetailPayload {
    identifier: string;
    engine: string;
    engineVersion: string;
    status: string;
    instanceClass: string;
    storageGb: number;
    storageType: string;
    multiAz: boolean;
    publiclyAccessible: boolean;
    createdAt: string | null;
    endpoint: string | null;
    port: number | null;
    vpcId: string | null;
    subnetGroup: string | null;
    availabilityZone: string | null;
    securityGroups: RdsSecurityGroup[];
    metrics: {
        cpuUtilization: number | null;
        dbConnections: number | null;
    };
    logFiles: RdsLogFile[];
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

// ── ALB Detail ────────────────────────────────────────────────────────────────
export interface AlbTargetGroupDetail {
    name: string;
    arn: string;
    protocol: string;
    port: number | null;
    targetType: string;
    healthyCount: number;
    totalCount: number;
    healthCheckPath: string;
    healthCheckProtocol: string;
    healthCheckStatus: string;
}

export interface AlbListener {
    protocol: string;
    port: number;
    sslPolicy: string | null;
    defaultAction: string;
}

export interface AlbDetailPayload {
    name: string;
    arn: string;
    dns: string;
    scheme: string;
    type: string;
    state: string;
    vpcId: string | null;
    createdAt: string | null;
    availabilityZones: string[];
    accessLogs: {
        enabled: boolean;
        bucket: string | null;
        prefix: string | null;
    };
    listeners: AlbListener[];
    targetGroups: AlbTargetGroupDetail[];
    tags: { Key: string; Value: string }[];
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

// ── ECS Detail ────────────────────────────────────────────────────────────────
export interface EcsServiceInfo {
    name: string;
    taskDefinition: string;
    runningCount: number;
    desiredCount: number;
    launchType: string;
    status: string;
}

export interface EcsTaskInfo {
    taskId: string;
    taskDefinition: string;
    lastStatus: string;
    startedAt: string | null;
    cpu: string;
    memory: string;
}

export interface EcsClusterEvent {
    message: string;
    createdAt: string | null;
}

export interface EcsDetailPayload {
    clusterName: string;
    clusterArn: string;
    status: string;
    runningTasksCount: number;
    pendingTasksCount: number;
    activeServicesCount: number;
    registeredContainerInstances: number;
    capacityProviders: string[];
    services: EcsServiceInfo[];
    tasks: EcsTaskInfo[];
    recentEvents: EcsClusterEvent[];
    tags: { Key: string; Value: string }[];
    metrics: {
        cpuUtilization: number | null;
        memoryUtilization: number | null;
        runningTaskCount: number | null;
        pendingTaskCount: number | null;
    };
    fetchedAt: string;
    _mock?: boolean;
}