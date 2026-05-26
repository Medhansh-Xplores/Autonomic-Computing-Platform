/**
 * runner.js — Google ADK Runner for ACP Portal AI Ops
 */

const { InMemoryRunner, isFinalResponse } = require('@google/adk');
const { createUserContent } = require('@google/genai');
const { orchestratorAgent } = require('./agents/orchestrator.agent');
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
    const session = await runner.sessionService.getSession({ appName: APP_NAME, userId, sessionId });
    const state = session?.state || {};
    console.log('[ADK] Raw app_health_findings:', state.app_health_findings);
    console.log('[ADK] Session state keys:', Object.keys(state));
    Object.entries(state).forEach(([k, v]) => {
        console.log(`[ADK] state.${k}: ${String(v).slice(0, 300)}`);
    });

    // Final report from orchestrator's own final response
    const finalReport = (() => {
        const finalTexts = allEvents.filter(e => e.isFinal).map(e => e.text).join('');
        return safeJsonParse(finalTexts) || null;
    })();

    let infraFindings = safeJsonParse(state.infra_health_findings);
    // Primary path for appFindings is textByAuthor — outputKey on sub-agents invoked
    // by an LlmAgent orchestrator does NOT reliably propagate to the parent session state.
    let appFindings = (() => {
        const appText = textByAuthor['app_health_agent'];
        return appText ? safeJsonParse(appText) : null;
    })() || safeJsonParse(state.app_health_findings);
    let remediation = safeJsonParse(state.remediation_results);

    // ── Fallback path 1: match by author name ─────────────────────────────────
    // outputKey writes to state but ParallelAgent sub-agents emit text events
    // under their own agent name. We parse those directly.
    if (!infraFindings) {
        const infraText = textByAuthor['infra_monitor_agent'];
        if (infraText) {
            infraFindings = safeJsonParse(infraText);
            if (infraFindings) console.log('[ADK] Extracted infraFindings from author event text');
        }
    }
    if (appFindings) {
        console.log('[ADK] appFindings resolved from primary path (textByAuthor or state)');
        if (appFindings.scanMeta) {
            console.log('[ADK] app_health scanMeta:', JSON.stringify(appFindings.scanMeta));
        } else {
            console.warn('[ADK] WARNING: appFindings has no scanMeta — agent may have returned partial JSON');
        }
    }
    if (!remediation) {
        const remText = textByAuthor['remediation_agent'];
        if (remText) {
            remediation = safeJsonParse(remText);
            if (remediation) console.log('[ADK] Extracted remediation from author event text');
        }
    }

    // ── Fallback path 2: scan all events by shape ─────────────────────────────
    if (!infraFindings || !appFindings || !remediation) {
        console.log('[ADK] Partial state — scanning all events by shape');

        for (const ev of allEvents) {
            const parsed = safeJsonParse(ev.text);
            if (!parsed) continue;

            if (!infraFindings && isInfraFinding(parsed, ev.author)) {
                infraFindings = parsed;
                console.log('[ADK] Extracted infraFindings from event stream (author:', ev.author, ')');
            }
            if (!appFindings && isAppFinding(parsed, ev.author)) {
                appFindings = parsed;
                console.log('[ADK] Extracted appFindings from event stream (author:', ev.author, ')');
            }
            if (!remediation && isRemediation(parsed, ev.author)) {
                remediation = parsed;
                console.log('[ADK] Extracted remediation from event stream (author:', ev.author, ')');
            }
        }
    }

    // Fallback path 3: orchestrator now runs app health tools directly,
    // so its final report IS the app findings source.
    if (!appFindings && finalReport) {
        appFindings = {
            findings: finalReport.appFindings || [],
            summary: finalReport.appSummary || 'App scan completed',
            scanMeta: finalReport.appScanMeta || null,
        };
        console.log('[ADK] Extracted appFindings from orchestrator final report, appScanMeta=', JSON.stringify(finalReport.appScanMeta));
    }

    console.log('[ADK] Final — infraFindings:', infraFindings ? 'OK' : 'NULL');
    console.log('[ADK] Final — appFindings:', appFindings ? 'OK' : 'NULL');
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
        appAgent: appAgentMeta,
        infraSummary: infraFindings?.summary || null,
        appSummary: finalReport?.appSummary || appFindings?.summary || null,
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
            finalReport = safeJsonParse(text);
        }
    }

    const session = await runner.sessionService.getSession({ appName: APP_NAME, userId, sessionId });
    return { report: finalReport, remediation: safeJsonParse(session?.state?.remediation_results) };
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