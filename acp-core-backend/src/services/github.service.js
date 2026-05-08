const axios = require('axios');

exports.getWorkflows = async (data) => {

    const { repoUrl, branch, isPrivate, token } = data;

    const parts = repoUrl.replace('https://github.com/', '').split('/');

    const owner = parts[0];
    const repo = parts[1].replace('.git', '');

    const headers = {
        Accept: 'application/vnd.github+json'
    };

    if (isPrivate && token) {
        headers.Authorization = `Bearer ${token}`;
    }

    const response = await axios.get(
        `https://api.github.com/repos/${owner}/${repo}/actions/workflows`,
        { headers }
    );

    return response.data.workflows;
};

exports.triggerWorkflow = async (data) => {
    const { repoUrl, branch, workflowId, token, inputs } = data;

    const parts = repoUrl.replace('https://github.com/', '').split('/');
    const owner = parts[0];
    const repo = parts[1].replace('.git', '');

    const headers = {
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28'
    };

    if (token) {
        headers.Authorization = `Bearer ${token}`;
    }

    // Trigger workflow
    const dispatchTime = Date.now();
    let dispatched = false;
    for (let attempt = 0; attempt < 5; attempt++) {
        try {
            await axios.post(
                `https://api.github.com/repos/${owner}/${repo}/actions/workflows/${workflowId}/dispatches`,
                { ref: branch, inputs: inputs || {} },
                { headers }
            );
            dispatched = true;
            break;
        } catch (err) {
            if (err.response?.status === 422) {
                // Workflow not yet indexed — wait and retry
                await new Promise(r => setTimeout(r, 5000));
            } else {
                throw err;
            }
        }
    }
    if (!dispatched) throw new Error(`Workflow ${workflowId} not found on branch ${branch} after retries. Ensure the workflow is committed to the default branch.`);

    // GitHub can lag; poll until the newly dispatched run is visible.
    // Selecting by created_at prevents picking an older completed run.
    let runId = null;
    for (let attempt = 0; attempt < 8; attempt++) {
        await new Promise(resolve => setTimeout(resolve, 2000));

        const runsResp = await axios.get(
            `https://api.github.com/repos/${owner}/${repo}/actions/workflows/${workflowId}/runs?branch=${encodeURIComponent(branch)}&event=workflow_dispatch&per_page=10`,
            { headers }
        );

        const runs = runsResp.data.workflow_runs || [];
        const matchedRun = runs.find((run) => {
            const createdAtMs = Date.parse(run.created_at || '');
            return Number.isFinite(createdAtMs) && createdAtMs >= (dispatchTime - 60000);
        });

        if (matchedRun) {
            runId = matchedRun.id;
            break;
        }
    }

    return { message: "Workflow triggered", runId };
};

// ─── NEW FUNCTION 1 ───────────────────────────────────────────────────────────
// Commit GitHub workflow file
exports.commitWorkflowFile = async ({ repoUrl, branch, token, workflowContent, appName }) => {
    const { owner, repo } = parseRepo(repoUrl);
    const safeAppName = appName
        .toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9-]/g, '');

    const filePath = `.github/workflows/deploy-${safeAppName}.yml`;

    const headers = {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${token}`,
        'X-GitHub-Api-Version': '2022-11-28'
    };

    let sha = undefined;

    try {
        const existing = await axios.get(
            `https://api.github.com/repos/${owner}/${repo}/contents/${filePath}`,
            { headers }
        );

        sha = existing.data.sha;
    } catch (e) {
        // file doesn't exist yet
    }

    const body = {
        message: 'chore: add ACP ECS deployment workflow',
        content: Buffer.from(workflowContent).toString('base64'),
        branch
    };

    if (sha) body.sha = sha;

    await axios.put(
        `https://api.github.com/repos/${owner}/${repo}/contents/${filePath}`,
        body,
        { headers }
    );
};


// ─── NEW FUNCTION 2 ───────────────────────────────────────────────────────────
// Set GitHub repo secret
exports.setRepoSecret = async ({ repoUrl, token, secretName, secretValue }) => {
    const { owner, repo } = parseRepo(repoUrl);

    const headers = {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${token}`,
        'X-GitHub-Api-Version': '2022-11-28'
    };

    const keyResp = await axios.get(
        `https://api.github.com/repos/${owner}/${repo}/actions/secrets/public-key`,
        { headers }
    );

    const { key, key_id } = keyResp.data;

    const sodium = require('libsodium-wrappers');

    await sodium.ready;

    const messageBytes = Buffer.from(secretValue);
    const keyBytes = Buffer.from(key, 'base64');

    const encryptedBytes = sodium.crypto_box_seal(
        messageBytes,
        keyBytes
    );

    const encryptedValue = Buffer.from(encryptedBytes).toString('base64');

    await axios.put(
        `https://api.github.com/repos/${owner}/${repo}/actions/secrets/${secretName}`,
        {
            encrypted_value: encryptedValue,
            key_id
        },
        { headers }
    );
};


// ─── HELPER ───────────────────────────────────────────────────────────────────
function parseRepo(repoUrl) {
    const cleaned = repoUrl
        .replace(/\.git$/, '')
        .replace(/^https?:\/\/github\.com\//, '')
        .replace(/\/+$/, '');

    const [owner, repo] = cleaned.split('/');

    return { owner, repo };
}