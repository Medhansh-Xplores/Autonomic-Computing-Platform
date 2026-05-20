/**
 * runner.js — Google ADK Runner for ACP Portal AI Ops
 * createUserContent comes from @google/genai, not @google/adk
 */

const { InMemoryRunner, isFinalResponse } = require('@google/adk');
const { createUserContent } = require('@google/genai');   // ← correct package
const { orchestratorAgent } = require('./agents/orchestrator.agent');

const APP_NAME = 'acp-aiops';

const runner = new InMemoryRunner({
    agent: orchestratorAgent,
    appName: APP_NAME,
});

async function runAiOps({ userId, accountId, region, mode = 'full' }) {
    const sessionId = `session-${Date.now()}-${Math.random().toString(36).slice(2)}`;

    await runner.sessionService.createSession({ appName: APP_NAME, userId, sessionId });

    const userMessage = createUserContent(
        JSON.stringify({ userId, accountId, region, mode })
    );

    let finalReport = null;

    for await (const event of runner.runAsync({ userId, sessionId, newMessage: userMessage })) {
        if (isFinalResponse(event) && event.content?.parts?.length) {
            const text = event.content.parts.filter(p => p.text).map(p => p.text).join('');
            try { finalReport = JSON.parse(text); } catch { finalReport = { raw: text }; }
        }
    }

    const session = await runner.sessionService.getSession({ appName: APP_NAME, userId, sessionId });
    const state = session?.state || {};

    let pendingApprovals = [];
    try {
        const rem = state.remediation_results ? JSON.parse(state.remediation_results) : null;
        pendingApprovals = rem?.pendingApproval || [];
    } catch { /* ignore */ }

    return {
        sessionId,
        report: finalReport,
        infraFindings: safeJsonParse(state.infra_health_findings),
        appFindings: safeJsonParse(state.app_health_findings),
        remediation: safeJsonParse(state.remediation_results),
        pendingApprovals,
    };
}

async function resumeAiOps({ sessionId, userId, approved, action, target }) {
    const msg = createUserContent(JSON.stringify({
        type: 'human_approval_response',
        approved, action, target,
        message: approved
            ? `Human approved: proceed with ${action} on ${target}`
            : `Human rejected: do NOT proceed with ${action} on ${target}. Create an incident instead.`,
    }));

    let finalReport = null;

    for await (const event of runner.runAsync({ userId, sessionId, newMessage: msg })) {
        if (isFinalResponse(event) && event.content?.parts?.length) {
            const text = event.content.parts.filter(p => p.text).map(p => p.text).join('');
            try { finalReport = JSON.parse(text); } catch { finalReport = { raw: text }; }
        }
    }

    const session = await runner.sessionService.getSession({ appName: APP_NAME, userId, sessionId });
    return { report: finalReport, remediation: safeJsonParse(session?.state?.remediation_results) };
}

function safeJsonParse(str) {
    if (!str) return null;
    try { return JSON.parse(str); } catch { return { raw: str }; }
}

module.exports = { runAiOps, resumeAiOps };
