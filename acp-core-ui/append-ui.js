const fs = require('fs');
let content = fs.readFileSync('src/app/automation-deployment/deploy-existing/deploy-existing.component.ts', 'utf8');

const injection = `
        // ── Azure App Service deploy ────────────────────────────────────────
        if (this.isAcpAzureAppServiceFlow()) {
            this.loading = true;

            const safeAppName = (this.appName || 'app')
                .toLowerCase()
                .replace(/\\s+/g, '-')
                .replace(/[^a-z0-9-]/g, '');

            const workflowName = \`deploy-\${safeAppName}-app-service.yml\`;

            const payload = {
                repoUrl: this.repoUrl,
                branch: this.branch || 'main',
                token: this.githubToken,
                frontendPath: this.frontendPath,
                backendPath: this.backendPath,
                account: this.azureAccount,
                acrName: this.acrName,
                appName: this.appName,
                appServiceName: this.containerAppName || safeAppName,
                region: this.region,
                port: this.azurePort
            };

            this.http.post(this.apiBase + 'github/deploy-azure-app-service', payload)
                .subscribe({
                    next: (res: any) => {
                        this.loading = false;
                        if (res.provisioning) {
                            this.router.navigate(['/automation-logs'], {
                                state: {
                                    phase: 'provisioning',
                                    appName: this.appName,
                                    repoUrl: this.repoUrl,
                                    branch: this.branch || 'main',
                                    token: this.githubToken,
                                    cloud: 'Azure',
                                    workflow: workflowName,
                                    deploymentMode: 'acp'
                                }
                            });
                        } else {
                            this.router.navigate(['/automation-logs'], {
                                state: {
                                    phase: 'github',
                                    repoUrl: this.repoUrl,
                                    workflow: workflowName,
                                    branch: this.branch || 'main',
                                    token: this.githubToken,
                                    deploymentId: res.deploymentId,
                                    runId: res.runId,
                                    appName: this.appName,
                                    cloud: 'Azure'
                                }
                            });
                        }
                    },
                    error: (err: any) => {
                        this.loading = false;
                        console.error('Azure App Service deploy failed', err);
                        alert('Deployment failed: ' + (err?.error?.message || 'Unknown error'));
                    }
                });
            return;
        }
`;

const marker = '        // ── Azure Container Apps deploy ────────────────────────────────────────';
content = content.replace(marker, injection + '\n' + marker);
fs.writeFileSync('src/app/automation-deployment/deploy-existing/deploy-existing.component.ts', content);
