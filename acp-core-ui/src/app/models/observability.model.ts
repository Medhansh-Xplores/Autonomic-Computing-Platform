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
