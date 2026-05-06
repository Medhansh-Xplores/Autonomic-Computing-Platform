const {
    ECSClient,
    DescribeServicesCommand,
    DescribeTasksCommand,
    ListTasksCommand,
} = require('@aws-sdk/client-ecs');

const {
    CloudWatchClient,
    GetMetricDataCommand,
    DescribeAlarmsCommand,
} = require('@aws-sdk/client-cloudwatch');

const {
    ElasticLoadBalancingV2Client,
    DescribeTargetHealthCommand,
    DescribeTargetGroupsCommand,
    DescribeLoadBalancersCommand,
} = require('@aws-sdk/client-elastic-load-balancing-v2');

// ── ECS ───────────────────────────────────────────────────────────────────────

exports.describeEcsService = async (credentials, region, cluster, serviceName) => {
    const ecs = new ECSClient({ region, credentials });

    const response = await ecs.send(new DescribeServicesCommand({
        cluster,
        services: [serviceName],
    }));

    if (!response.services || response.services.length === 0) {
        throw new Error(`ECS service "${serviceName}" not found in cluster "${cluster}"`);
    }

    return response.services[0];
};

exports.describeEcsTasks = async (credentials, region, cluster, serviceName) => {
    const ecs = new ECSClient({ region, credentials });

    const listed = await ecs.send(new ListTasksCommand({
        cluster,
        serviceName,
        desiredStatus: 'RUNNING',
    }));

    if (!listed.taskArns || listed.taskArns.length === 0) {
        return [];
    }

    const described = await ecs.send(new DescribeTasksCommand({
        cluster,
        tasks: listed.taskArns,
    }));

    return described.tasks || [];
};

// ── CloudWatch ────────────────────────────────────────────────────────────────

exports.getEcsMetrics = async (credentials, region, cluster, serviceName) => {
    const cw = new CloudWatchClient({ region, credentials });

    const now = new Date();
    const fiveMinAgo = new Date(now.getTime() - 5 * 60 * 1000);

    const dimensions = [
        { Name: 'ClusterName', Value: cluster },
        { Name: 'ServiceName', Value: serviceName },
    ];

    const response = await cw.send(new GetMetricDataCommand({
        StartTime: fiveMinAgo,
        EndTime: now,
        MetricDataQueries: [
            {
                Id: 'cpu',
                MetricStat: {
                    Metric: {
                        Namespace: 'ECS/ContainerInsights',
                        MetricName: 'CpuUtilized',
                        Dimensions: dimensions,
                    },
                    Period: 300,
                    Stat: 'Average',
                },
            },
            {
                Id: 'cpu_reserved',
                MetricStat: {
                    Metric: {
                        Namespace: 'ECS/ContainerInsights',
                        MetricName: 'CpuReserved',
                        Dimensions: dimensions,
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
                        Dimensions: dimensions,
                    },
                    Period: 300,
                    Stat: 'Average',
                },
            },
            {
                Id: 'mem_reserved',
                MetricStat: {
                    Metric: {
                        Namespace: 'ECS/ContainerInsights',
                        MetricName: 'MemoryReserved',
                        Dimensions: dimensions,
                    },
                    Period: 300,
                    Stat: 'Average',
                },
            },
        ],
    }));

    const pickValue = (id) => {
        const result = response.MetricDataResults?.find(r => r.Id === id);
        const values = result?.Values || [];
        return values.length > 0 ? values[0] : null;
    };

    const cpuUsed = pickValue('cpu');
    const cpuReserved = pickValue('cpu_reserved');
    const memUsed = pickValue('mem');
    const memReserved = pickValue('mem_reserved');

    return {
        cpuUtilization: (cpuUsed !== null && cpuReserved) ? Math.round((cpuUsed / cpuReserved) * 1000) / 10 : null,
        memoryUtilization: (memUsed !== null && memReserved) ? Math.round((memUsed / memReserved) * 1000) / 10 : null,
    };
};

exports.getActiveAlarms = async (credentials, region, cluster) => {
    const cw = new CloudWatchClient({ region, credentials });

    const response = await cw.send(new DescribeAlarmsCommand({
        AlarmNamePrefix: cluster,
        StateValue: 'ALARM',
    }));

    return (response.MetricAlarms || []).map(a => ({
        name: a.AlarmName,
        description: a.AlarmDescription || '',
        stateReason: a.StateReason || '',
    }));
};

// ── ALB ───────────────────────────────────────────────────────────────────────

exports.getTargetGroupHealth = async (credentials, region, cluster) => {
    const elb = new ElasticLoadBalancingV2Client({ region, credentials });

    // Find target groups whose names contain the cluster name
    const tgResponse = await elb.send(new DescribeTargetGroupsCommand({}));
    const tgs = (tgResponse.TargetGroups || []).filter(tg =>
        tg.TargetGroupName.toLowerCase().includes(cluster.toLowerCase())
    );

    if (tgs.length === 0) return null;

    const tg = tgs[0];
    const healthResponse = await elb.send(new DescribeTargetHealthCommand({
        TargetGroupArn: tg.TargetGroupArn,
    }));

    const targets = healthResponse.TargetHealthDescriptions || [];
    const healthy = targets.filter(t => t.TargetHealth?.State === 'healthy').length;
    const total = targets.length;

    return {
        targetGroupName: tg.TargetGroupName,
        healthyCount: healthy,
        totalCount: total,
    };
};
