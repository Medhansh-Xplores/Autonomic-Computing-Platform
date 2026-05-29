/**
 * runner.js — Google ADK Runner for ACP Portal AI Ops
 */

const { InMemoryRunner, isFinalResponse } = require('@google/adk');
const { createUserContent } = require('@google/genai');
const { orchestratorAgent } = require('./agents/orchestrator.agent');
const { _handlers } = require('./tools/remediation.tools');

const db = require('../config/db');

const APP_NAME = 'acp-aiops';

const runner = new InMemoryRunner({
    agent: orchestratorAgent,
    appName: APP_NAME,
});

async function runAiOps({ userId, accountId, region, mode = 'full' }) {
    const sessionId = `session-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const scanStartedAt = new Date().toISOString();

    await runner.sessionService.createSession({ appName: APP_NAME, userId, sessionId });

    const userMessage = createUserContent(
        JSON.stringify({ userId, accountId, region, mode })
    );

    // Collect ALL event text — keyed by author so we can match sub-agents
    const allEvents = [];
    // Also track text per-author for targeted extraction
    const textByAuthor = {};

    for await (const event of runner.runAsync({ userId, sessionId, newMessage: userMessage })) {
        try {
            const author = event.author || 'unknown';
            const parts = event.content?.parts || [];
            const isFinal = isFinalResponse(event);

            parts.forEach((part, i) => {
                if (part.text) {
                    console.log(`[ADK] author=${author} final=${isFinal} text[${i}] (${part.text.length}c): ${part.text.slice(0, 300)}`);
                    allEvents.push({ author, text: part.text, isFinal });
                    // Accumulate text per author (agents may stream in multiple parts)
                    if (!textByAuthor[author]) textByAuthor[author] = '';
                    textByAuthor[author] += part.text;
                }
                if (part.functionCall) {
                    console.log(`[ADK] author=${author} CALL: ${part.functionCall.name}(${JSON.stringify(part.functionCall.args).slice(0, 150)})`);
                }
                if (part.functionResponse) {
                    console.log(`[ADK] author=${author} RESULT: ${part.functionResponse.name} → ${JSON.stringify(part.functionResponse.response).slice(0, 150)}`);
                    // AgentTool wraps sub-agent output as {"result": "<text>"} in the function response.
                    // Extract it here so fallback paths can use it even when the agent emits no text event.
                    const fnName = part.functionResponse.name;
                    const fnResult = part.functionResponse.response?.result;
                    if (fnName === 'app_health_agent' && fnResult) {
                        const parsed = safeJsonParse(fnResult);
                        if (parsed) {
                            console.log('[ADK] Extracted appFindings directly from AgentTool function response');
                            if (!textByAuthor['app_health_agent']) textByAuthor['app_health_agent'] = fnResult;
                        }
                    }
                    if (fnName === 'infra_monitor_agent' && fnResult) {
                        const parsed = safeJsonParse(fnResult);
                        if (parsed && !textByAuthor['infra_monitor_agent']) {
                            textByAuthor['infra_monitor_agent'] = fnResult;
                        }
                    }
                }
            });
            // ADK error events have no content.parts — log them explicitly
            if (!parts.length && (event.errorCode || event.errorMessage)) {
                console.error(`[ADK] ERROR EVENT author=${author} errorCode=${event.errorCode} msg=${event.errorMessage}`);
            }
        } catch (evErr) {
            console.error('[ADK] Error processing event:', evErr.message);
        }
    }

    console.log(`[ADK] Loop done. Total text events: ${allEvents.length}`);
    console.log(`[ADK] Authors seen: ${Object.keys(textByAuthor).join(', ') || '(none)'}`);

    // ── Primary path: read from session state ─────────────────────────────────
    // SequentialAgent + outputKey writes reliably to session state.
    // infra_monitor_agent → 'infra_health_findings'
    // app_health_agent    → 'app_health_findings'
    // acp_aiops_orchestrator → 'orchestrator_report'
    const session = await runner.sessionService.getSession({ appName: APP_NAME, userId, sessionId });
    const state = session?.state || {};
    console.log('[ADK] Session state keys:', Object.keys(state));
    Object.entries(state).forEach(([k, v]) => {
        console.log(`[ADK] state.${k}: ${String(v).slice(0, 300)}`);
    });

    // Final report from the orchestrator's own outputKey
    const finalReport = safeJsonParse(state.orchestrator_report)
        || (() => {
            const finalTexts = allEvents.filter(e => e.isFinal).map(e => e.text).join('');
            return safeJsonParse(finalTexts) || null;
        })();

    // ── Primary: session state (SequentialAgent outputKey writes here) ────────
    let infraFindings = safeJsonParse(state.infra_health_findings);
    let appFindings = safeJsonParse(state.app_health_findings);
    let remediation = safeJsonParse(state.remediation_results);

    // ── Fallback 1: author text events ────────────────────────────────────────
    if (!infraFindings && textByAuthor['infra_monitor_agent']) {
        infraFindings = safeJsonParse(textByAuthor['infra_monitor_agent']);
        if (infraFindings) console.log('[ADK] infraFindings from author text event');
    }
    if (!appFindings && textByAuthor['app_health_agent']) {
        appFindings = safeJsonParse(textByAuthor['app_health_agent']);
        if (appFindings) console.log('[ADK] appFindings from author text event');
    }
    if (!remediation && textByAuthor['remediation_agent']) {
        remediation = safeJsonParse(textByAuthor['remediation_agent']);
        if (remediation) console.log('[ADK] remediation from author text event');
    }

    // ── Fallback 2: shape-scan all events ────────────────────────────────────
    if (!infraFindings || !appFindings) {
        console.log('[ADK] Partial state — scanning all events by shape');
        for (const ev of allEvents) {
            const parsed = safeJsonParse(ev.text);
            if (!parsed) continue;
            if (!infraFindings && isInfraFinding(parsed, ev.author)) {
                infraFindings = parsed;
                console.log('[ADK] infraFindings from event stream (author:', ev.author, ')');
            }
            if (!appFindings && isAppFinding(parsed, ev.author)) {
                appFindings = parsed;
                console.log('[ADK] appFindings from event stream (author:', ev.author, ')');
            }
            if (!remediation && isRemediation(parsed, ev.author)) {
                remediation = parsed;
                console.log('[ADK] remediation from event stream (author:', ev.author, ')');
            }
        }
    }

    // ── Fallback 3: orchestrator final report ─────────────────────────────────
    if (!appFindings && finalReport?.appFindings !== undefined) {
        appFindings = {
            findings: finalReport.appFindings || [],
            summary: finalReport.appSummary || null,
            scanMeta: finalReport.appScanMeta || null,
        };
        console.log('[ADK] appFindings from orchestrator final report');
    }
    if (!infraFindings && finalReport?.infraSummary) {
        infraFindings = { summary: finalReport.infraSummary, findings: [], scanMeta: null };
        console.log('[ADK] infraFindings from orchestrator final report');
    }

    console.log('[ADK] Final — infraFindings:', infraFindings ? 'OK' : 'NULL');
    console.log('[ADK] Final — appFindings:', appFindings ? 'OK' : 'NULL');
    if (appFindings?.scanMeta) console.log('[ADK] appFindings.scanMeta:', JSON.stringify(appFindings.scanMeta));
    console.log('[ADK] Final — remediation:', remediation ? 'OK' : 'NULL');

    const scanCompletedAt = new Date().toISOString();
    let pendingApprovals = [];
    try { pendingApprovals = remediation?.pendingApproval || []; } catch { /* ignore */ }

    // appScanMeta now comes from the orchestrator's final report directly
    // (since app health tools are on the orchestrator, not a sub-agent)
    const appAgentMeta = appFindings?.scanMeta
        || finalReport?.appScanMeta
        || null;

    const scanMeta = {
        sessionId,
        scanStartedAt,
        scanCompletedAt,
        durationMs: new Date(scanCompletedAt) - new Date(scanStartedAt),
        mode,
        accountId,
        region,
        infraAgent: infraFindings?.scanMeta || null,
        appAgent: appFindings?.scanMeta || finalReport?.appScanMeta || null,
        infraSummary: infraFindings?.summary || finalReport?.infraSummary || null,
        appSummary: appFindings?.summary || finalReport?.appSummary || null,
    };

    try {
        await db.query(
            `INSERT INTO aiops_scan_runs
         (session_id, user_id, account_id, region, mode, status, infra_findings, app_findings, remediation, scan_meta, started_at, completed_at)
         VALUES ($1,$2,$3,$4,$5,'completed',$6,$7,$8,$9,$10, NOW())`,
            [
                sessionId,
                userId,
                accountId,
                region,
                mode,
                JSON.stringify(infraFindings),
                JSON.stringify(appFindings),
                JSON.stringify(remediation),
                JSON.stringify(scanMeta),
                scanStartedAt,
            ]
        );
    } catch (err) {
        console.error('[aiops] Failed to save scan run:', err.message);
    }

    return {
        sessionId,
        report: finalReport,
        infraFindings,
        appFindings,
        remediation,
        pendingApprovals,
        scanMeta,
    };
}

// ── Shape detectors ────────────────────────────────────────────────────────────

function isInfraFinding(obj, author) {
    if (author && (author.includes('infra'))) return true;
    return (
        obj.findings !== undefined &&
        Array.isArray(obj.findings) &&
        (obj.findings.length === 0 || (
            obj.findings[0]?.resourceType !== undefined &&
            obj.findings[0]?.appName === undefined
        ))
    );
}

function isAppFinding(obj, author) {
    if (author?.includes('app_health')) return true;
    if (obj.agentName === 'app_health_agent') return true;  // ← add this
    return (
        obj.findings !== undefined &&
        Array.isArray(obj.findings) &&
        obj.findings.length > 0 &&       // ← remove the length===0 ambiguous branch
        obj.findings[0]?.appName !== undefined
    );
}

function isRemediation(obj, author) {
    if (author && author.includes('remediation')) return true;
    return obj.actionsAttempted !== undefined || obj.pendingApproval !== undefined;
}

async function resumeAiOps({ sessionId, userId, approved, action, target, accountId, region, desiredCount, reason }) {
    if (!approved) {
        await db.query(
            `INSERT INTO aiops_audit_log (user_id, action, target, reason, approved, result, created_at)
             VALUES ($1, $2, $3, $4, false, $5, NOW())`,
            [userId, action, target, reason || 'User rejected', JSON.stringify({ rejected: true })]
        );
        return { report: null, remediation: { rejected: true, action, target } };
    }

    let result;
    try {
        if (action === 'scale_ecs_service') {
            const [cluster, serviceName] = target.split('/');
            result = await _handlers.scale_ecs_service({
                accountId, region, userId, cluster, serviceName,
                desiredCount: desiredCount ?? 1,
                reason: reason || 'Human approved via ACP Portal',
                approvedByUser: true,
            });
        } else if (action === 'restart_ecs_service') {
            const [cluster, serviceName] = target.split('/');
            result = await _handlers.restart_ecs_service({
                accountId, region, userId, cluster, serviceName,
                reason: reason || 'Human approved via ACP Portal',
                approvedByUser: true,
            });
        } else if (action === 'reboot_rds_instance') {
            result = await _handlers.reboot_rds_instance({
                accountId, region, userId,
                dbIdentifier: target,
                reason: reason || 'Human approved via ACP Portal',
                approvedByUser: true,
            });
        } else {
            result = { success: false, message: `Unknown action: ${action}` };
        }
    } catch (err) {
        result = { success: false, action, target, message: err.message };
    }

    return { report: result, remediation: { actionsAttempted: [{ action, target, result }] } };
}

/**
 * Robustly parse JSON that Gemini may have wrapped in markdown fences.
 */
function safeJsonParse(str) {
    if (!str) return null;

    // 1. Try as-is
    try { return JSON.parse(str); } catch { /* fall through */ }

    // 2. Strip ```json ... ``` fences
    const stripped = str.replace(/^```(?:json)?\s*/m, '').replace(/```\s*$/m, '').trim();
    try { return JSON.parse(stripped); } catch { /* fall through */ }

    // 3. Extract first {...} block
    const match = stripped.match(/\{[\s\S]*\}/);
    if (match) {
        try { return JSON.parse(match[0]); } catch { /* fall through */ }
    }

    console.error('[safeJsonParse] Failed. Raw:\n', str.slice(0, 500));
    return null;
}

module.exports = { runAiOps, resumeAiOps };
