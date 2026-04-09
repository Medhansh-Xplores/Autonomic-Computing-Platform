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
    await axios.post(
        `https://api.github.com/repos/${owner}/${repo}/actions/workflows/${workflowId}/dispatches`,
        { ref: branch, inputs: inputs || {} },
        { headers }
    );

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
            return Number.isFinite(createdAtMs) && createdAtMs >= (dispatchTime - 10000);
        });

        if (matchedRun) {
            runId = matchedRun.id;
            break;
        }
    }

    return { message: "Workflow triggered", runId };
};