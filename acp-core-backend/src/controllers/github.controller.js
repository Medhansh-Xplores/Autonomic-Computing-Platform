const githubService = require('../services/github.service');
const axios = require("axios");
const AdmZip = require('adm-zip');

exports.getWorkflows = async (req, res) => {
    try {
        const workflows = await githubService.getWorkflows(req.body);
        res.json(workflows);
    } catch (error) {
        console.error(error);
        res.status(500).json({
            message: 'Failed to fetch workflows'
        });
    }
};

exports.triggerWorkflow = async (req, res) => {
    try {

        const response = await githubService.triggerWorkflow(req.body);

        res.json(response);

    } catch (error) {

        console.error(error);

        res.status(500).json({
            message: 'Failed to trigger workflow'
        });

    }
};

exports.getLogs = async (req, res) => {
    try {
        const token = req.query.token || "";
        const repoUrl = req.query.repoUrl || "";
        const workflow = req.query.workflow; // optional if runId provided
        const branch = req.query.branch || "main";
        const runId = req.query.runId; // <-- new

        if (!repoUrl) {
            return res.status(400).json({ error: "repoUrl is required" });
        }
        if (!runId && !workflow) {
            return res.status(400).json({ error: "runId or workflow is required" });
        }

        // Normalize repoUrl -> owner/repo
        const cleaned = repoUrl
            .replace(/\.git$/, "")
            .replace(/^https?:\/\/github\.com\//, "")
            .replace(/\/+$/, "");
        const [owner, repo] = cleaned.split("/");

        if (!owner || !repo) {
            return res.status(400).json({ error: "Invalid repoUrl format" });
        }

        const headers = {
            Accept: 'application/vnd.github+json',
            ...(token ? { Authorization: `Bearer ${token}` } : {})
        };

        // Get the correct run
        let run = null;

        if (runId) {
            const runResp = await axios.get(
                `https://api.github.com/repos/${owner}/${repo}/actions/runs/${runId}`,
                { headers }
            );
            run = runResp.data;
        } else {
            const runsResp = await axios.get(
                `https://api.github.com/repos/${owner}/${repo}/actions/workflows/${workflow}/runs?branch=${encodeURIComponent(branch)}&event=workflow_dispatch&per_page=1`,
                { headers }
            );
            run = runsResp.data.workflow_runs?.[0] || null;
        }

        if (!run) {
            return res.json({ steps: [], complete: false, failed: false, url: null });
        }

        // Jobs => steps (for step cards)
        const jobs = await axios.get(run.jobs_url, { headers });

        const steps = [];
        for (const job of jobs.data.jobs || []) {
            for (const step of job.steps || []) {
                steps.push({
                    name: step.name,
                    status: step.status,
                    conclusion: step.conclusion
                });
            }
        }

        const complete = run.status === "completed";
        const failed = complete && run.conclusion !== "success";

        let url = null;

        // Only download & parse Terraform outputs when completed
        if (complete) {
            const logsZipResp = await axios.get(
                `https://api.github.com/repos/${owner}/${repo}/actions/runs/${run.id}/logs`,
                {
                    headers,
                    responseType: 'arraybuffer'
                }
            );

            const zip = new AdmZip(logsZipResp.data);
            const fullText = zip.getEntries()
                .map(e => e.getData().toString())
                .join("\n");

            // Example pattern you said exists:
            // frontend_url -= https://...
            const m = fullText.match(/frontend_url\s*[-=]+\s*"?\s*(https?:\/\/[^\s"'<>\)]+)/i);
            url = m ? m[1] : null;
        }

        res.json({
            steps,
            complete,
            failed,
            url,
            runId: run.id
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to fetch logs" });
    }
};