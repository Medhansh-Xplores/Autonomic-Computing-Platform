/**
 * runner.js — ADK Runner for ACP Application Generation
 *
 * Follows the same pattern as aiops/runner.js:
 *   InMemoryRunner → SequentialAgent → session state → safeJsonParse fallbacks
 */

const { InMemoryRunner, isFinalResponse } = require('@google/adk');
const { createUserContent } = require('@google/genai');
const { runGithubCommit } = require('./agents/github-commit.agent');

const APP_NAME = 'acp-app-generation';

// Lazy singleton
let _runner = null;

function getRunner() {
    if (!_runner) {
        const { appGenerationOrchestrator } = require('./agents/app-orchestrator.agent');
        _runner = new InMemoryRunner({
            agent: appGenerationOrchestrator,
            appName: APP_NAME,
        });
    }
    return _runner;
}

/**
 * runAppGeneration
 *
 * @param {object} payload - Full form payload from the frontend
 * @param {string} userId  - Authenticated user's username
 * @returns {{ repoUrl, filesCommitted, summary, generatedFiles, sessionId }}
 */
async function runAppGeneration(payload, userId) {
    const sessionId = `appsession-${Date.now()}-${Math.random().toString(36).slice(2)}`;

    const runner = getRunner();
    await runner.sessionService.createSession({ appName: APP_NAME, userId, sessionId });

    // The codegen agent receives the full spec.
    // The github agent needs both the spec AND the generated files.
    // We pass everything in one message — the github agent's prompt
    // instructs it to read generated_files from session state.
    const userMessage = createUserContent(JSON.stringify({
        // Step 1 & 2: app spec for code gen
        appName: payload.appName,
        appType: payload.appType,
        appDescription: payload.appDescription,
        frontendFramework: payload.frontendFramework || null,
        backendFramework: payload.backendFramework,
        frontendDescription: payload.frontendDescription || null,
        backendDescription: payload.backendDescription,
        apiEndpoints: payload.apiEndpoints || '',
        database: payload.database || 'none',
        authType: payload.authType || 'none',
        dataModels: payload.dataModels || '',
        containerPort: payload.containerPort || 8080,
        cloudProvider: payload.cloudProvider,
        deploymentType: payload.deploymentType,
        environment: payload.environment,
        // Step 4: GitHub config (for github commit agent)
        repoName: payload.repoName,
        githubOrg: payload.githubOrg,
        branch: payload.branch || 'main',
        isPrivate: payload.isPrivate || false,
        githubPAT: payload.githubPAT || '',
    }));

    // Collect events (same pattern as aiops/runner.js)
    const allEvents = [];
    const textByAuthor = {};

    for await (const event of runner.runAsync({ userId, sessionId, newMessage: userMessage })) {
        try {
            const author = event.author || 'unknown';
            const parts = event.content?.parts || [];
            const isFinal = isFinalResponse(event);

            parts.forEach((part, i) => {
                if (part.text) {
                    console.log(`[AppGen] author=${author} final=${isFinal} text[${i}] (${part.text.length}c): ${part.text.slice(0, 200)}`);
                    allEvents.push({ author, text: part.text, isFinal });
                    if (!textByAuthor[author]) textByAuthor[author] = '';
                    textByAuthor[author] += part.text;
                }
                if (part.functionCall) {
                    const safeArgs = { ...part.functionCall.args };
                    if (safeArgs.token) safeArgs.token = '[REDACTED]';
                    if (safeArgs.githubPAT) safeArgs.githubPAT = '[REDACTED]';
                    console.log(`[AppGen] author=${author} CALL: ${part.functionCall.name}(${JSON.stringify(safeArgs).slice(0, 120)})`);
                }
                if (part.functionResponse) {
                    console.log(`[AppGen] author=${author} RESULT: ${part.functionResponse.name} → ${JSON.stringify(part.functionResponse.response).slice(0, 120)}`);
                }
            });

            if (!parts.length && (event.errorCode || event.errorMessage)) {
                console.error(`[AppGen] ERROR author=${author} errorCode=${event.errorCode} msg=${event.errorMessage}`);
            }
        } catch (evErr) {
            console.error('[AppGen] Event processing error:', evErr.message);
        }
    }

    console.log(`[AppGen] Loop done. Authors: ${Object.keys(textByAuthor).join(', ') || '(none)'}`);

    // ── Read from session state (primary path) ────────────────────────────────
    const session = await runner.sessionService.getSession({ appName: APP_NAME, userId, sessionId });
    const state = session?.state || {};
    console.log('[AppGen] Session state keys:', Object.keys(state));

    // ── Parse generated_files ─────────────────────────────────────────────────
    let generatedFiles = safeJsonParse(state.generated_files);
    if (!generatedFiles && textByAuthor['codegen_agent']) {
        generatedFiles = safeJsonParse(textByAuthor['codegen_agent']);
        if (generatedFiles) console.log('[AppGen] generatedFiles from author text event');
    }
    if (!generatedFiles) {
        for (const ev of allEvents) {
            const parsed = safeJsonParse(ev.text);
            if (parsed?.files && Array.isArray(parsed.files)) {
                generatedFiles = parsed;
                console.log('[AppGen] generatedFiles from event stream shape scan');
                break;
            }
        }
    }

    // ── Parse github_result ───────────────────────────────────────────────────
    console.log('[AppGen] generatedFiles:', generatedFiles ? `${generatedFiles.files?.length} files` : 'NULL');

    // ── Commit files directly (no agent — avoids 64K output token limit) ──────
    let githubResult = null;
    if (generatedFiles?.files?.length) {
        console.log('[AppGen] Running direct GitHub commit...');
        githubResult = await runGithubCommit({
            repoName: payload.repoName,
            githubOrg: payload.githubOrg,
            branch: payload.branch || 'main',
            isPrivate: payload.isPrivate ?? false,
            githubPAT: payload.githubPAT || '',
            appName: payload.appName,
            appDescription: payload.appDescription,
            generatedFiles,
        });
        console.log('[AppGen] githubResult:', githubResult ? `repoUrl=${githubResult.repoUrl} files=${githubResult.filesCommitted}` : 'NULL');
    } else {
        console.warn('[AppGen] No generatedFiles — skipping GitHub commit');
    }

    // ── Persist record to DB ──────────────────────────────────────────────────
    try {
        const applicationModel = require('../models/application.model');
        const frontendFw = payload.frontendFramework || null;
        const backendFw = payload.backendFramework || null;
        const techStack = frontendFw ? `${frontendFw} / ${backendFw}` : backendFw;

        await applicationModel.createApplication({
            appName: payload.appName,
            appType: payload.appType,
            techStack,
            cloudProvider: payload.cloudProvider,
            deploymentType: payload.deploymentType,
            environment: payload.environment,
            repoName: payload.repoName,
            githubOrg: payload.githubOrg,
            repoUrl: githubResult?.repoUrl || null,
            filesCommitted: githubResult?.filesCommitted || 0,
            status: githubResult?.error ? 'Failed' : 'Completed',
            userId,
        });
    } catch (dbErr) {
        console.error('[AppGen] Failed to persist application record:', dbErr.message);
        // Non-fatal — don't fail the response if DB write fails
    }

    return {
        sessionId,
        repoUrl: githubResult?.repoUrl || null,
        filesCommitted: githubResult?.filesCommitted || 0,
        failedFiles: githubResult?.failedFiles || [],
        summary: githubResult?.summary || generatedFiles?.summary || 'Generation complete',
        generatedFiles: generatedFiles?.files || [],
        error: githubResult?.error || null,
    };
}

// ── Same safeJsonParse as aiops/runner.js ─────────────────────────────────────
function safeJsonParse(str) {
    if (!str) return null;
    try { return JSON.parse(str); } catch { /* fall through */ }
    const stripped = str.replace(/^```(?:json)?\s*/m, '').replace(/```\s*$/m, '').trim();
    try { return JSON.parse(stripped); } catch { /* fall through */ }
    const match = stripped.match(/\{[\s\S]*\}/);
    if (match) {
        try { return JSON.parse(match[0]); } catch { /* fall through */ }
    }
    console.error('[AppGen][safeJsonParse] Failed. Raw:\n', str.slice(0, 500));
    return null;
}

module.exports = { runAppGeneration };
