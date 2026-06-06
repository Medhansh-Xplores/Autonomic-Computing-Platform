/**
 * app-orchestrator.agent.js
 *
 * Previously a SequentialAgent with codegenAgent + githubCommitAgent.
 * GitHub committing is now handled directly in runner.js to avoid
 * Gemini 64K output token limit on large apps (20+ files).
 *
 * This file now just exports the codegenAgent as the sole pipeline agent.
 */

const { SequentialAgent } = require('@google/adk');
const { codegenAgent } = require('./codegen.agent');

const appGenerationOrchestrator = new SequentialAgent({
    name: 'acp_app_generation_pipeline',
    description: 'ACP app generation pipeline: code gen only',
    subAgents: [codegenAgent],
});

module.exports = { appGenerationOrchestrator };