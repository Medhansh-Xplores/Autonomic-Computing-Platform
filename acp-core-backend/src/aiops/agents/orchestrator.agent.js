/**
 * orchestrator.agent.js
 *
 * Architecture: SequentialAgent (root)
 *   Step 1: infraMonitorAgent  → writes 'infra_health_findings' to session state
 *   Step 2: appHealthAgent     → writes 'app_health_findings' to session state
 *   Step 3: orchestratorAgent  → reads both, writes 'orchestrator_report' to state
 *
 * WHY: AgentTool wrapping causes Gemini to return {"result":""} (empty string)
 * for sub-agents that call tools. SequentialAgent + outputKey is the correct
 * ADK pattern — each agent writes to shared session state, the next reads it.
 * No AgentTool, no mixed tool types, no 400 proto errors.
 */

const { LlmAgent, SequentialAgent } = require('@google/adk');
const { infraMonitorAgent } = require('./infra-monitor.agent');
const { appHealthAgent } = require('./app-health.agent');
const { remediationAgent } = require('./remediation.agent');

// ── Step 3: Orchestrator — reads from state, synthesizes final report ─────────
const ORCHESTRATOR_PROMPT = `
You are the ACP Portal AI Ops Orchestrator. The previous agents have already
run and stored their findings in session state. Your job is to read those
findings and produce the final consolidated report.

The session state contains:
- infra_health_findings: JSON from the Infra Monitor Agent
- app_health_findings: JSON from the App Health Agent

## Mode handling:

### mode = "observe"
  Read infra_health_findings and app_health_findings from state.
  Do NOT call remediation_phase. Produce final JSON report.

### mode = "full"
  Read infra_health_findings and app_health_findings from state.
  Call remediation_phase with the findings.
  Produce final JSON report.

### mode = "remediate-only"
  Skip infra and app findings.
  Call remediation_phase.
  Produce final JSON report.

## Input format:
{
  "userId": "john.doe",
  "accountId": "123456789012",
  "region": "us-east-1",
  "mode": "observe" | "full" | "remediate-only",
  "infra_health_findings": { ...from state... },
  "app_health_findings": { ...from state... }
}

## Output — always return ONLY valid JSON, no markdown fences:
{
  "mode": "<mode used>",
  "summary": "<one sentence overall summary>",
  "infraSummary": "<summary from infra_health_findings.summary or null>",
  "appSummary": "<summary from app_health_findings.summary or null>",
  "appFindings": "<findings array from app_health_findings.findings or []>",
  "remediationSummary": null,
  "pendingApprovals": [],
  "incidentsCreated": []
}

CRITICAL: Copy infraSummary from infra_health_findings.summary exactly.
CRITICAL: Copy appSummary from app_health_findings.summary exactly.
CRITICAL: Copy appFindings from app_health_findings.findings exactly.
CRITICAL: Output ONLY the JSON object. No explanation. No markdown fences.
`;

const orchestratorAgent = new LlmAgent({
  name: 'acp_aiops_orchestrator',
  model: 'gemini-2.5-pro',
  description: 'Synthesizes infra and app health findings into a final report.',
  instruction: ORCHESTRATOR_PROMPT,
  tools: [],  // No tools — reads from state, synthesizes only
  outputKey: 'orchestrator_report',
});

// ── Root: SequentialAgent runs all three in order ─────────────────────────────
// outputKey on each LlmAgent writes to session state automatically.
// The next agent in sequence can read it via state injection or prompt reference.
const acpAiOpsAgent = new SequentialAgent({
  name: 'acp_aiops_pipeline',
  description: 'ACP AI Ops pipeline: infra scan → app scan → remediation → orchestration',
  subAgents: [infraMonitorAgent, appHealthAgent, remediationAgent, orchestratorAgent],
});

module.exports = { orchestratorAgent: acpAiOpsAgent };
