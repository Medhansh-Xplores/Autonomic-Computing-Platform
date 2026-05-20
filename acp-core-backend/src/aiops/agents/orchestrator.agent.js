/**
 * orchestrator.agent.js
 *
 * Google ADK Agent: Orchestrator (Root Agent)
 *
 * This is the entry point for the entire AI Ops pipeline.
 * It runs the Infra Monitor and App Health agents in parallel,
 * collects their findings, then invokes the Remediation Agent.
 *
 * Flow:
 *   Orchestrator
 *     ├── [parallel] infraMonitorAgent
 *     ├── [parallel] appHealthAgent
 *     └── [sequential] remediationAgent (receives combined findings)
 */

const { LlmAgent, ParallelAgent, SequentialAgent } = require('@google/adk');
const { infraMonitorAgent } = require('./infra-monitor.agent');
const { appHealthAgent } = require('./app-health.agent');
const { remediationAgent } = require('./remediation.agent');

// ── Step 1: Run infra + app health checks in parallel ─────────────────────────
const monitoringPhase = new ParallelAgent({
    name: 'monitoring_phase',
    description: 'Runs infra and app health checks in parallel',
    subAgents: [infraMonitorAgent, appHealthAgent],
});

// ── Step 2: Pass findings to remediation ──────────────────────────────────────
// The SequentialAgent passes session state between steps.
// remediationAgent reads infra_health_findings and app_health_findings from state.
const remediationPhase = new SequentialAgent({
    name: 'remediation_phase',
    description: 'Decides and executes remediation based on combined findings',
    subAgents: [remediationAgent],
});

// ── Root Orchestrator ─────────────────────────────────────────────────────────
const ORCHESTRATOR_PROMPT = `
You are the ACP Portal AI Ops Orchestrator. You coordinate the health monitoring
and auto-remediation pipeline for cloud infrastructure and applications.
 
You have access to two sub-agent pipelines:
1. monitoring_phase: Runs infra and app health checks in parallel. Call this first.
2. remediation_phase: Uses the findings to decide and execute fixes. Call this second.
 
## Your process:
1. Call monitoring_phase with the userId, accountId, and region from the input.
2. Wait for results. Both agents store their findings in session state automatically.
3. Call remediation_phase. It will read those findings and act.
4. Return a consolidated report to the user with:
   - What was found (summary from each agent)
   - What was fixed automatically
   - What needs human attention
   - Any incidents created
 
## Input you receive will look like:
{
  "userId": "john.doe",
  "accountId": "123456789012",
  "region": "us-east-1",
  "mode": "full"   // or "observe" (skip remediation) or "remediate-only"
}
 
## Mode handling:
- "full": run monitoring then remediation (default)
- "observe": run monitoring only, no remediation — just return findings
- "remediate-only": skip monitoring, run remediation on last known findings
 
Always be transparent about what actions were taken and what requires human review.
`;

const orchestratorAgent = new LlmAgent({
    name: 'acp_aiops_orchestrator',
    model: 'gemini-2.0-flash',
    description: 'Root AI Ops orchestrator for ACP Portal. Coordinates health monitoring and auto-remediation.',
    instruction: ORCHESTRATOR_PROMPT,
    subAgents: [monitoringPhase, remediationPhase],
    outputKey: 'orchestrator_report',
});

module.exports = { orchestratorAgent };
