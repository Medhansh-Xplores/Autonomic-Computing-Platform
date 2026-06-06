/**
 * github.tools.js
 *
 * ADK FunctionTool definitions that wrap github.service.js
 * for use by the GitHub Commit Agent.
 *
 * Tools:
 *  - create_github_repo    : creates a new repo via GitHub API
 *  - commit_file_to_repo   : commits a single file (path + content) to the repo
 *  - set_repo_secret       : sets a GitHub Actions secret on the repo
 */

const axios = require('axios');
const githubService = require('../../services/github.service');

// ── Helper ────────────────────────────────────────────────────────────────────
function parseRepo(repoUrl) {
    const cleaned = repoUrl
        .replace(/\.git$/, '')
        .replace(/^https?:\/\/github\.com\//, '')
        .replace(/\/+$/, '');
    const [owner, repo] = cleaned.split('/');
    return { owner, repo };
}

// ── Tool: create_github_repo ──────────────────────────────────────────────────
const createGithubRepo = {
    name: 'create_github_repo',
    description: `Creates a new GitHub repository under the given org/user.
Returns the full repo URL on success.
Call this FIRST before committing any files.`,
    parameters: {
        type: 'object',
        properties: {
            githubOrg: { type: 'string', description: 'GitHub organisation or username' },
            repoName: { type: 'string', description: 'Repository name (slug, no spaces)' },
            isPrivate: { type: 'boolean', description: 'true = private repo, false = public' },
            token: { type: 'string', description: 'GitHub Personal Access Token (PAT)' },
            description: { type: 'string', description: 'Short repo description (optional)' },
        },
        required: ['githubOrg', 'repoName', 'isPrivate', 'token'],
    },
    handler: async ({ githubOrg, repoName, isPrivate, token, description }) => {
        try {
            const headers = {
                Accept: 'application/vnd.github+json',
                Authorization: `Bearer ${token}`,
                'X-GitHub-Api-Version': '2022-11-28',
            };

            // Try creating under org first, fall back to user
            let repoUrl;
            try {
                const resp = await axios.post(
                    `https://api.github.com/orgs/${githubOrg}/repos`,
                    { name: repoName, private: isPrivate, description: description || '', auto_init: true },
                    { headers }
                );
                repoUrl = resp.data.html_url;
            } catch (orgErr) {
                if (orgErr.response?.status === 404 || orgErr.response?.status === 422) {
                    // Not an org — try user repo
                    const resp = await axios.post(
                        `https://api.github.com/user/repos`,
                        { name: repoName, private: isPrivate, description: description || '', auto_init: true },
                        { headers }
                    );
                    repoUrl = resp.data.html_url;
                } else {
                    throw orgErr;
                }
            }

            return { success: true, repoUrl };
        } catch (err) {
            return { success: false, error: err.response?.data?.message || err.message };
        }
    },
};

// ── Tool: commit_file_to_repo ─────────────────────────────────────────────────
const commitFileToRepo = {
    name: 'commit_file_to_repo',
    description: `Commits a single file to a GitHub repository.
Call this once per file. Use the repoUrl returned by create_github_repo.`,
    parameters: {
        type: 'object',
        properties: {
            repoUrl: { type: 'string', description: 'Full GitHub repo URL, e.g. https://github.com/org/repo' },
            filePath: { type: 'string', description: 'Path inside the repo, e.g. src/index.js' },
            content: { type: 'string', description: 'Full file content as a string' },
            commitMessage: { type: 'string', description: 'Git commit message' },
            branch: { type: 'string', description: 'Branch to commit to, e.g. main' },
            token: { type: 'string', description: 'GitHub Personal Access Token (PAT)' },
        },
        required: ['repoUrl', 'filePath', 'content', 'branch', 'token'],
    },
    handler: async ({ repoUrl, filePath, content, commitMessage, branch, token }) => {
        try {
            await githubService.commitFile(
                repoUrl,
                filePath,
                content,
                commitMessage || `chore: add ${filePath}`,
                branch,
                token
            );
            return { success: true, filePath };
        } catch (err) {
            return { success: false, filePath, error: err.response?.data?.message || err.message };
        }
    },
};

// ── Tool: set_repo_secret ─────────────────────────────────────────────────────
const setRepoSecret = {
    name: 'set_repo_secret',
    description: `Sets a GitHub Actions secret on the repository.
Use this to store credentials needed by CI/CD workflows.`,
    parameters: {
        type: 'object',
        properties: {
            repoUrl: { type: 'string', description: 'Full GitHub repo URL' },
            token: { type: 'string', description: 'GitHub Personal Access Token (PAT)' },
            secretName: { type: 'string', description: 'Secret name, e.g. AWS_ACCESS_KEY_ID' },
            secretValue: { type: 'string', description: 'Secret value' },
        },
        required: ['repoUrl', 'token', 'secretName', 'secretValue'],
    },
    handler: async ({ repoUrl, token, secretName, secretValue }) => {
        try {
            await githubService.setRepoSecret({ repoUrl, token, secretName, secretValue });
            return { success: true, secretName };
        } catch (err) {
            return { success: false, secretName, error: err.response?.data?.message || err.message };
        }
    },
};

// ── Wrap as ADK FunctionTool instances (required — plain objects lack .getTools()) ──
const { FunctionTool } = require('@google/adk');

function toFunctionTool(toolDef) {
    return new FunctionTool({
        name: toolDef.name,
        description: toolDef.description,
        parameters: toolDef.parameters,
        execute: toolDef.handler,
    });
}

module.exports = {
    createGithubRepo: toFunctionTool(createGithubRepo),
    commitFileToRepo: toFunctionTool(commitFileToRepo),
    setRepoSecret: toFunctionTool(setRepoSecret),
};
