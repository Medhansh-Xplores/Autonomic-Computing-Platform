import { Component, OnInit, OnDestroy } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { EnvService } from 'src/environments/env.service';

@Component({
    selector: 'app-automation-logs',
    templateUrl: './automation-logs.component.html',
    styleUrls: ['./automation-logs.component.css']
})
export class AutomationLogsComponent implements OnInit, OnDestroy {

    steps: any[] = [];

    token = "";
    repoUrl = "";
    workflow = "";
    branch = "";
    deploymentId = "";
    runId = "";
    appName = "";
    cloud = "";

    apiBase: string;
    intervalId: any;

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
    }

    ngOnInit() {

        this.intervalId = setInterval(() => {

            this.http.get<any>(this.apiBase + 'github/workflows/logs', {
                params: {
                    token: this.token,
                    repoUrl: this.repoUrl,
                    workflow: this.workflow,
                    branch: this.branch,
                    runId: this.runId
                }
            })
                .subscribe({

                    next: (data: any) => {

                        this.steps = data.steps || [];

                        // NOT completed yet → keep running
                        if (!data.complete) {
                            this.status = "Deployment Running...";
                            return;
                        }

                        // Completed
                        clearInterval(this.intervalId);

                        const failed = !!data.failed;

                        this.status = failed
                            ? "Deployment Failed ❌"
                            : "Deployment Completed ✅";

                        this.isComplete = true;

                        if (this.deploymentId) {
                            this.http.patch(
                                this.apiBase + 'deployments/' + this.deploymentId + '/status',
                                {
                                    status: failed ? 'Failed' : 'Deployed',
                                    url: data.url || null
                                }
                            ).subscribe({
                                error: (err) => console.error('Status update failed', err)
                            });
                        }

                    },

                    error: (err) => {
                        console.error("Error fetching logs", err);
                    }

                });

        }, 2000);

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

    ngOnDestroy() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
        }
    }

}