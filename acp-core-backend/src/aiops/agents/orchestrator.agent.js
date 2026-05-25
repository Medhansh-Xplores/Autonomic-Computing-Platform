/**
 * orchestrator.agent.js
 *
 * Google ADK Agent: Orchestrator (Root Agent)
 *
 * Flow:
 *   Orchestrator (has infra tools + app tools + remediation tool directly)
 *     └── [tool] remediationAgent (still wrapped as AgentTool)
 *
 * NOTE: appHealthAgent is NOT wrapped as AgentTool anymore.
 * AgentTool causes Gemini to invoke the sub-agent but then return {"result":""}
 * (empty string) — the inner agent calls its tools but emits no final text.
 * Instead we give the orchestrator the app health tools directly and instruct
 * it to write its findings under the app_health_findings session key.
 */

const { LlmAgent, AgentTool } = require('@google/adk');
const { infraMonitorAgent } = require('./infra-monitor.agent');
const { remediationAgent } = require('./remediation.agent');
const {
  getAppHealth,
  getAllDeploymentsHealth,
  getCloudWatchAlarms,
} = require('../tools/observability.tools');

// Infra agent still works fine as AgentTool — keep it
const infraTool = new AgentTool({ agent: infraMonitorAgent });

// Remediation agent as AgentTool — keep it
const remediationTool = new AgentTool({ agent: remediationAgent });

// ── Root Orchestrator ─────────────────────────────────────────────────────────
const ORCHESTRATOR_PROMPT = `
You are the ACP Portal AI Ops Orchestrator. You coordinate health monitoring
and auto-remediation for cloud infrastructure and applications.

You have access to these tools:
1. infra_monitor_agent — checks AWS infrastructure health (VPCs, ECS clusters, RDS, ALBs). Call this first (unless remediate-only mode).
2. get_all_deployments_health — call this to get a summary of all app deployments health. Pass userId from the input.
3. get_app_health — call this for each unhealthy/degraded app found in step 2. Pass accountId, region, cluster, serviceName, userId.
4. get_cloudwatch_alarms — call this if any ECS cluster has active alarms.
5. remediation_phase — executes fixes based on findings. Call this after monitoring (unless observe mode).

## App health process (steps 2-4):
1. Call get_all_deployments_health with userId.
2. For each deployment that is NOT healthy, call get_app_health to get full details.
3. Analyze results: running vs desired counts, alarms, stopped task reasons.
4. Build the appFindings array from your analysis.
5. Build appScanMeta with: agentName="app_health_agent", appsChecked=<total deployments found>, healthyApps=<count>, unhealthyApps=<count>, resourcesChecked=<total deployments found>, timestamp=<ISO8601 now>.

## Mode handling — follow strictly:

### mode = "observe"
  1. Call infra_monitor_agent.
  2. Run app health check (steps 2-4 above).
  3. Return JSON summary. Do NOT call remediation_phase.

### mode = "full" (default)
  1. Call infra_monitor_agent.
  2. Run app health check (steps 2-4 above).
  3. Call remediation_phase.
  4. Return consolidated JSON report.

### mode = "remediate-only"
  1. Do NOT call infra_monitor_agent or app health tools.
  2. Call remediation_phase.
  3. Return remediation JSON report.

## Input format:
{
  "userId": "john.doe",
  "accountId": "123456789012",
  "region": "us-east-1",
  "mode": "observe" | "full" | "remediate-only"
}

## Output — always return valid JSON, never null fields:
{
  "mode": "<mode used>",
  "summary": "<one sentence summary>",
  "infraSummary": "<from infra agent or null>",
  "appSummary": "<one sentence describing app health results>",
  "appFindings": [],
  "appScanMeta": {
    "agentName": "app_health_agent",
    "appsChecked": <number>,
    "healthyApps": <number>,
    "unhealthyApps": <number>,
    "resourcesChecked": <number>,
    "timestamp": "<ISO8601>"
  },
  "remediationSummary": "<from remediation agent or null>",
  "pendingApprovals": [],
  "incidentsCreated": []
}

CRITICAL: appScanMeta must always be present with accurate counts. Never omit it.
`;

const orchestratorAgent = new LlmAgent({
  name: 'acp_aiops_orchestrator',
  model: 'gemini-2.5-flash',
  description: 'Root AI Ops orchestrator for ACP Portal.',
  instruction: ORCHESTRATOR_PROMPT,
  tools: [
    infraTool,
    getAllDeploymentsHealth,   // app health tools directly on orchestrator
    getAppHealth,
    getCloudWatchAlarms,
    remediationTool,
  ],
  outputKey: 'orchestrator_report',
});

module.exports = { orchestratorAgent };