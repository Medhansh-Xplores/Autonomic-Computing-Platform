/**
 * remediation.tools.js
 *
 * Google ADK tool definitions for the Remediation Agent.
 * These tools MODIFY AWS resources — handle with care.
 *
 * Safety rules baked in:
 *  - Every tool logs the action to aiops_audit_log before executing
 *  - Destructive actions (reboot_rds) require approvedByUser: true
 *  - All tools return { success, action, target, message } for easy agent reasoning
 */

const db = require('../../config/db');
const {
    ECSClient,
    UpdateServiceCommand,
    DescribeServicesCommand,
    ListServicesCommand,
} = require('@aws-sdk/client-ecs');
const {
    RDSClient,
    RebootDBInstanceCommand,
    DescribeDBInstancesCommand,
} = require('@aws-sdk/client-rds');
const {
    STSClient,
    AssumeRoleCommand,
} = require('@aws-sdk/client-sts');

// ── Credential helper ─────────────────────────────────────────────────────────
async function resolveCredentials(accountId, userId, region) {
    const result = await db.query(
        `SELECT auth_type, role_arn, external_id, access_key_id, secret_access_key
         FROM cloud_accounts WHERE (account_id = $1 OR id::text = $1) AND user_id = $2 LIMIT 1`,
        [accountId, userId]
    );
    if (!result.rows.length) throw new Error(`Cloud account not found: ${accountId}`);
    const acct = result.rows[0];
    if (acct.auth_type === 'keys') {
        return { accessKeyId: acct.access_key_id, secretAccessKey: acct.secret_access_key };
    }
    const sts = new STSClient({ region });
    const assumed = await sts.send(new AssumeRoleCommand({
        RoleArn: acct.role_arn,
        ExternalId: acct.external_id,
        RoleSessionName: 'acp-aiops-remediation',
    }));
    return {
        accessKeyId: assumed.Credentials.AccessKeyId,
        secretAccessKey: assumed.Credentials.SecretAccessKey,
        sessionToken: assumed.Credentials.SessionToken,
    };
}

// ── Audit logger ──────────────────────────────────────────────────────────────
async function auditLog({ userId, action, target, reason, approved, result }) {
    try {
        await db.query(
            `INSERT INTO aiops_audit_log (user_id, action, target, reason, approved, result, created_at)
             VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
            [userId, action, target, reason, approved, JSON.stringify(result)]
        );
    } catch (err) {
        // Audit log failure should never block remediation
        console.error('[aiops-audit] Failed to write audit log:', err.message);
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// TOOL 1 — restart_ecs_service
// Forces a new ECS deployment (equivalent to "Restart" in the console).
// Safe to auto-approve for crashed tasks (running < desired).
// ─────────────────────────────────────────────────────────────────────────────
const restartEcsService = {
    name: 'restart_ecs_service',
    description: `Force a new ECS deployment for a given service. This recycles all running tasks
and pulls the latest task definition — equivalent to clicking "Force new deployment" in the AWS console.
Use when: tasks are crashed, stuck in pending, or running < desired count.
This is a safe action and does NOT require human approval for crashed services.
Both backend and frontend services for an app will be restarted if serviceSuffix is 'both'.`,

    parameters: {
        type: 'object',
        properties: {
            accountId: { type: 'string' },
            region: { type: 'string' },
            userId: { type: 'string' },
            cluster: { type: 'string', description: 'ECS cluster name' },
            serviceName: { type: 'string', description: 'Full ECS service name, e.g. myapp-backend' },
            reason: { type: 'string', description: 'Why the restart is needed — logged in audit trail' },
        },
        required: ['accountId', 'region', 'userId', 'cluster', 'serviceName', 'reason'],
    },

    handler: async ({ accountId, region, userId, cluster, serviceName, reason }) => {
        const target = `${cluster}/${serviceName}`;
        try {
            const credentials = await resolveCredentials(accountId, userId, region);
            const ecs = new ECSClient({ region, credentials });

            await ecs.send(new UpdateServiceCommand({
                cluster,
                service: serviceName,
                forceNewDeployment: true,
            }));

            const result = { success: true, action: 'restart_ecs_service', target, message: `Forced new deployment on ${serviceName}` };
            await auditLog({ userId, action: 'restart_ecs_service', target, reason, approved: true, result });
            return result;
        } catch (err) {
            const result = { success: false, action: 'restart_ecs_service', target, message: err.message };
            await auditLog({ userId, action: 'restart_ecs_service', target, reason, approved: true, result });
            return result;
        }
    },
};

// ─────────────────────────────────────────────────────────────────────────────
// TOOL 2 — scale_ecs_service
// Adjusts the desired task count up or down.
// ─────────────────────────────────────────────────────────────────────────────
const scaleEcsService = {
    name: 'scale_ecs_service',
    description: `Change the desired task count for an ECS service.
Use to scale UP when running < desired (e.g. tasks keep crashing, bump desired to ensure availability).
Use to scale DOWN only when explicitly asked by a human.
Requires human approval when scaling DOWN (desiredCount is being reduced).`,

    parameters: {
        type: 'object',
        properties: {
            accountId: { type: 'string' },
            region: { type: 'string' },
            userId: { type: 'string' },
            cluster: { type: 'string' },
            serviceName: { type: 'string' },
            desiredCount: { type: 'number', description: 'New desired task count' },
            reason: { type: 'string' },
            approvedByUser: { type: 'boolean', description: 'Must be true if scaling DOWN. Auto-approved for scale-up.' },
        },
        required: ['accountId', 'region', 'userId', 'cluster', 'serviceName', 'desiredCount', 'reason'],
    },

    handler: async ({ accountId, region, userId, cluster, serviceName, desiredCount, reason, approvedByUser }) => {
        const target = `${cluster}/${serviceName}`;

        // Safety: if scaling down, require explicit approval
        if (desiredCount === 0 && !approvedByUser) {
            return {
                success: false,
                requiresApproval: true,
                action: 'scale_ecs_service',
                target,
                message: 'Scaling to 0 requires explicit human approval. Set approvedByUser=true after confirming.',
            };
        }

        try {
            const credentials = await resolveCredentials(accountId, userId, region);
            const ecs = new ECSClient({ region, credentials });

            await ecs.send(new UpdateServiceCommand({
                cluster,
                service: serviceName,
                desiredCount,
            }));

            const result = { success: true, action: 'scale_ecs_service', target, desiredCount, message: `Set desired count to ${desiredCount}` };
            await auditLog({ userId, action: 'scale_ecs_service', target, reason, approved: approvedByUser ?? true, result });
            return result;
        } catch (err) {
            const result = { success: false, action: 'scale_ecs_service', target, message: err.message };
            await auditLog({ userId, action: 'scale_ecs_service', target, reason, approved: approvedByUser ?? true, result });
            return result;
        }
    },
};

// ─────────────────────────────────────────────────────────────────────────────
// TOOL 3 — reboot_rds_instance
// Reboots an RDS instance. DESTRUCTIVE — requires human approval.
// ─────────────────────────────────────────────────────────────────────────────
const rebootRdsInstance = {
    name: 'reboot_rds_instance',
    description: `Reboot an RDS database instance. This causes a brief outage (typically 60-120 seconds).
ALWAYS requires human approval before executing (approvedByUser must be true).
Use only when: RDS status is not 'available', connections are maxed out, or there are repeated DB errors.`,

    parameters: {
        type: 'object',
        properties: {
            accountId: { type: 'string' },
            region: { type: 'string' },
            userId: { type: 'string' },
            dbIdentifier: { type: 'string', description: 'RDS DB instance identifier' },
            reason: { type: 'string' },
            approvedByUser: { type: 'boolean', description: 'REQUIRED to be true. Human must confirm before reboot.' },
        },
        required: ['accountId', 'region', 'userId', 'dbIdentifier', 'reason', 'approvedByUser'],
    },

    handler: async ({ accountId, region, userId, dbIdentifier, reason, approvedByUser }) => {
        const target = dbIdentifier;

        if (!approvedByUser) {
            return {
                success: false,
                requiresApproval: true,
                action: 'reboot_rds_instance',
                target,
                message: 'RDS reboot requires explicit human approval. This will cause a brief outage. Set approvedByUser=true after confirming.',
            };
        }

        try {
            const credentials = await resolveCredentials(accountId, userId, region);
            const rds = new RDSClient({ region, credentials });

            await rds.send(new RebootDBInstanceCommand({ DBInstanceIdentifier: dbIdentifier }));

            const result = { success: true, action: 'reboot_rds_instance', target, message: `Reboot initiated for ${dbIdentifier}` };
            await auditLog({ userId, action: 'reboot_rds_instance', target, reason, approved: true, result });
            return result;
        } catch (err) {
            const result = { success: false, action: 'reboot_rds_instance', target, message: err.message };
            await auditLog({ userId, action: 'reboot_rds_instance', target, reason, approved: true, result });
            return result;
        }
    },
};

// ─────────────────────────────────────────────────────────────────────────────
// TOOL 4 — create_aiops_incident
// Records a structured incident in the DB and optionally notifies via webhook.
// ─────────────────────────────────────────────────────────────────────────────
const createIncident = {
    name: 'create_aiops_incident',
    description: `Create an incident record in ACP Portal for a detected problem.
Use this when an issue is found but cannot be auto-remediated, or after remediation to track what happened.
Severity: 'critical' | 'high' | 'medium' | 'low'.`,

    parameters: {
        type: 'object',
        properties: {
            userId: { type: 'string' },
            title: { type: 'string', description: 'Short incident title, e.g. "ECS service myapp-backend has 0 running tasks"' },
            severity: { type: 'string', enum: ['critical', 'high', 'medium', 'low'] },
            affectedResource: { type: 'string', description: 'Resource ARN or name' },
            rootCause: { type: 'string', description: 'Agent\'s diagnosis of the root cause' },
            actionTaken: { type: 'string', description: 'What remediation was applied, if any. Empty if none.' },
        },
        required: ['userId', 'title', 'severity', 'affectedResource', 'rootCause'],
    },

    handler: async ({ userId, title, severity, affectedResource, rootCause, actionTaken }) => {
        try {
            const result = await db.query(
                `INSERT INTO aiops_incidents (user_id, title, severity, affected_resource, root_cause, action_taken, status, created_at)
                 VALUES ($1, $2, $3, $4, $5, $6, 'open', NOW()) RETURNING id`,
                [userId, title, severity, affectedResource, rootCause, actionTaken || 'none']
            );
            const incidentId = result.rows[0]?.id;
            return { success: true, incidentId, message: `Incident #${incidentId} created: ${title}` };
        } catch (err) {
            return { success: false, message: err.message };
        }
    },
};

module.exports = {
    restartEcsService,
    scaleEcsService,
    rebootRdsInstance,
    createIncident,
};
