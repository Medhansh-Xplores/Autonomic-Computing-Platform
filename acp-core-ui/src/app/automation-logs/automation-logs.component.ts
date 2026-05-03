// ADD at top with imports
import { Component, OnInit, OnDestroy, ViewChild, ElementRef, AfterViewChecked } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { EnvService } from 'src/environments/env.service';

@Component({
    selector: 'app-automation-logs',
    templateUrl: './automation-logs.component.html',
    styleUrls: ['./automation-logs.component.css']
})
export class AutomationLogsComponent implements OnInit, OnDestroy, AfterViewChecked {

    steps: any[] = [];

    token = "";
    repoUrl = "";
    workflow = "";
    branch = "";
    deploymentId = "";
    runId = "";
    appName = "";
    cloud = "";
    // ADD these alongside existing properties
    phase = 'github'; // default keeps existing behaviour unchanged
    terraformLogs: string[] = [];
    terraformDone = false;
    terraformFailed = false;
    private tfInterval: any;
    private waitInterval: any;
    @ViewChild('terminalBox') terminalBox!: ElementRef;
    private shouldScroll = false;
    apiBase: string;
    intervalId: any;
    deploymentMode = '';

    status = "Deployment Started...";
    isComplete = false;

    constructor(
        private http: HttpClient,
        private router: Router,
        private envService: EnvService
    ) {

        this.apiBase = this.envService.apiUrl;

        const navigation = this.router.getCurrentNavigation();
        const state = navigation?.extras?.state;

        this.token = state?.['token'] || "";
        this.repoUrl = state?.['repoUrl'] || "";
        this.workflow = state?.['workflow'] || "";
        this.branch = state?.['branch'] || "";
        this.deploymentId = state?.['deploymentId'] || "";
        this.runId = state?.['runId'] || "";
        this.appName = state?.['appName'] || "";
        this.cloud = state?.['cloud'] || "";
        this.phase = state?.['phase'] || 'github';
        this.deploymentMode = state?.['deploymentMode'] || '';
    }

    ngOnInit() {

        if (this.phase === 'provisioning') {
            this.status = 'Creating Services...';
            this.startTerraformPolling();
            return; // 🚀 VERY IMPORTANT
        }

        if (this.repoUrl && this.runId) {
            this.startGithubPolling();
        }

    }

    goBack() {
        this.router.navigate(['/deploy-existing'], {
            state: {
                returnToWorkflows: true,
                repoUrl: this.repoUrl,
                branch: this.branch,
                token: this.token,
                source: 'GitHub',
                repoType: this.token ? 'private' : 'public',
                appName: this.appName,
                cloud: this.cloud
            }
        });
    }

    goToDeployments() {
        this.router.navigate(['/view-deployments']);
    }

    startGithubPolling() {
        let completing = false;  // ← guard flag

        this.intervalId = setInterval(() => {
            if (completing || this.isComplete) {
                clearInterval(this.intervalId);
                return;
            }

            this.http.get<any>(this.apiBase + 'github/workflows/logs', {
                params: {
                    token: this.token,
                    repoUrl: this.repoUrl,
                    workflow: this.workflow,
                    branch: this.branch,
                    runId: this.runId
                }
            }).subscribe({
                next: (data: any) => {
                    this.steps = data.steps || [];

                    if (!data.complete) {
                        this.status = 'Deployment Running...';
                        return;
                    }

                    completing = true;         // ← set before clearInterval
                    clearInterval(this.intervalId);

                    const failed = !!data.failed;
                    this.status = failed ? 'Deployment Failed ❌' : 'Deployment Completed ✅';
                    this.isComplete = true;

                    if (this.deploymentId) {

                        const updatePayload: any = {
                            status: failed ? 'Failed' : 'Deployed'
                        };

                        // ✅ ONLY add url if it exists
                        if (data.url) {
                            updatePayload.url = data.url;
                        }

                        this.http.patch(
                            this.apiBase + 'deployments/' + this.deploymentId + '/status',
                            updatePayload
                        ).subscribe({
                            error: (err) => console.error('Status update failed', err)
                        });
                    }
                },
                error: (err) => console.error('Error fetching logs', err)
            });
        }, 5000);
    }

    startTerraformPolling() {
        this.tfInterval = setInterval(() => {
            this.http.get<any>(this.apiBase + 'github/terraform-logs')
                .subscribe({
                    next: (data) => {
                        this.terraformLogs = data.logs || [];
                        this.shouldScroll = true;
                        if (!data.done) return;

                        clearInterval(this.tfInterval);
                        this.terraformDone = true;

                        if (data.failed) {
                            this.terraformFailed = true;
                            this.status = 'Service Creation Failed ❌';
                            this.isComplete = true;
                            return;
                        }

                        // Terraform done — wait for runId then start GitHub polling
                        this.phase = 'waiting';
                        this.status = 'Setting up GitHub Actions...';
                        this.startWaitingForRunId();
                    },
                    error: (err) => console.error('Terraform log poll error', err)
                });
        }, 5000);
    }

    startWaitingForRunId() {
        this.waitInterval = setInterval(() => {
            this.http.get<any>(this.apiBase + 'github/pending-deployment', {
                params: { appName: this.appName }
            }).subscribe({
                next: (data) => {
                    if (!data.ready) return;
                    clearInterval(this.waitInterval);

                    if (data.error) {
                        this.status = 'Deployment Failed ❌';
                        this.isComplete = true;
                        return;
                    }

                    this.runId = data.runId;
                    this.deploymentId = data.deploymentId;

                    const safeAppName = (this.appName || 'app')
                        .toLowerCase()
                        .replace(/\s+/g, '-')
                        .replace(/[^a-z0-9-]/g, '');

                    const workflowName = `deploy-${safeAppName}.yml`;

                    this.workflow = workflowName; // ADD
                    this.phase = 'github';
                    this.status = 'Deployment Running...';

                    // ADD: log to confirm values before polling starts
                    console.log('Switching to GitHub polling:', {
                        repoUrl: this.repoUrl,
                        workflow: this.workflow,
                        branch: this.branch,
                        token: this.token,
                        runId: this.runId
                    });

                    this.startGithubPolling();
                },
                error: (err) => console.error('Pending deployment poll error', err)
            });
        }, 5000);
    }

    ngAfterViewChecked() {
        if (this.shouldScroll && this.terminalBox) {
            const el = this.terminalBox.nativeElement;
            el.scrollTop = el.scrollHeight;
            this.shouldScroll = false;
        }
    }

    ngOnDestroy() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
        }
        if (this.tfInterval) clearInterval(this.tfInterval);
        if (this.waitInterval) clearInterval(this.waitInterval);
    }

}