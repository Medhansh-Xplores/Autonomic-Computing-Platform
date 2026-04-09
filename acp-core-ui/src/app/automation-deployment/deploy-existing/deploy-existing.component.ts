import { Component } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { EnvService } from 'src/environments/env.service';
import { Router } from '@angular/router';

@Component({
    selector: 'app-deploy-existing',
    templateUrl: './deploy-existing.component.html',
    styleUrls: ['./deploy-existing.component.css']
})
export class DeployExistingComponent {

    constructor(
        private http: HttpClient,
        private envService: EnvService,
        private router: Router
    ) {
        const navigation = this.router.getCurrentNavigation();
        const state = navigation?.extras?.state;

        if (state?.['returnToWorkflows']) {

            this.source = state['source'] || 'GitHub';
            this.repoUrl = state['repoUrl'] || '';
            this.branch = state['branch'] || '';
            this.githubToken = state['token'] || '';
            this.repoType = state['repoType'] || (this.githubToken ? 'private' : 'public');

            this.loadingWorkflows = true;
            this.loadWorkflows();
        }
    }

    divToShow = 1;
    apiBase = this.envService.apiUrl;

    source: any;
    cloud: any;
    deployment: any;
    deploymentOptions: any[] = [];
    appName: any;
    port: any;
    cpu: any;
    memory: any;
    repoUrl: any;
    branch: any;
    dockerfilePath: any;
    healthPath: any;
    dockerImage: any;
    deploymentMode: any;
    workflow: any;
    zipFile: any;
    startCommand: any;
    workflows: any[] = [];
    selectedWorkflow: any;
    repoType: any = 'public';
    githubToken: any;
    account: any;
    region: any;
    ecsCluster: any;
    ecsOptions: any[] = [];
    accountOptions: any[] = [
        { accountID: '377122171982', accountName: 'Autonomic Root Account' }
    ];
    regionOptions: any[] = [
        'us-east-1',
        'us-east-2',
        'us-west-1',
        'us-west-2',
        'ap-south-1',
        'eu-west-1'
    ];
    ecrRepository: any;
    ecrImageTag: any;
    containerName: any;
    containerPort: any;

    loading = false;
    loadingWorkflows = false;
    loadingSteps = false;

    isAcpAwsEcsFlow(): boolean {
        return this.source === 'GitHub'
            && this.deploymentMode === 'acp'
            && this.cloud === 'AWS'
            && this.deployment === 'ECS Fargate';
    }

    nextPage() {

        // Page 1
        if (this.divToShow === 1) {

            if (!this.source) {
                alert('Please select Application Source');
                return;
            }

            if (this.source === 'GitHub') {

                if (!this.deploymentMode) {
                    alert('Please select Deployment Mode');
                    return;
                }

                if (this.deploymentMode === 'acp') {

                    if (!this.cloud || !this.deployment) {
                        alert('Please select Cloud and Deployment Type');
                        return;
                    }
                }
            }
        }

        if (this.isAcpAwsEcsFlow()) {
            if (this.divToShow === 2) {
                if (!this.account || !this.region || !this.ecsCluster) {
                    alert('Please select Account, Region and ECS Cluster');
                    return;
                }
                this.divToShow++;
                return;
            }

            if (this.divToShow === 3) {
                if (!this.repoUrl || !this.branch) {
                    alert('Please fill GitHub details');
                    return;
                }
                if (this.repoType === 'private' && !this.githubToken) {
                    alert('Please provide GitHub token for private repository');
                    return;
                }
                this.divToShow++;
                return;
            }

            if (this.divToShow === 4) {
                if (!this.appName || !this.containerName || !this.containerPort || !this.ecrRepository || !this.ecrImageTag) {
                    alert('Please fill app container and ECR configuration');
                    return;
                }
                this.divToShow++;
                return;
            }
        }

        // Page 2 → Load workflows (Repository YAML flow)
        if (this.divToShow === 2 && this.source === 'GitHub') {

            if (!this.repoUrl || !this.branch) {
                alert('Please fill GitHub details');
                return;
            }

            if (!this.appName) {
                alert('Please enter Deployment Name');
                return;
            }

            if (!this.cloud) {
                alert('Please select Cloud Platform');
                return;
            }

            this.loadingWorkflows = true;
            this.loadWorkflows();
            return;
        }

        // Page 3 → Deploy (Repository YAML flow)
        if (this.divToShow === 3) {

            if (!this.selectedWorkflow) {
                alert('Please select a workflow');
                return;
            }

            this.loadingSteps = true;
            this.deploy();
            return;
        }

        this.divToShow++;
    }


    loadWorkflows() {

        // TURN LOADER ON
        this.loadingWorkflows = true;

        if (!this.repoUrl || !this.branch) {
            this.loadingWorkflows = false;
            this.divToShow = 2;
            return;
        }

        const payload: any = {
            repoUrl: this.repoUrl,
            branch: this.branch,
            isPrivate: this.repoType === 'private'
        };

        if (this.githubToken) {
            payload.token = this.githubToken;
        }

        this.http.post(
            this.apiBase + "github/workflows",
            payload
        ).subscribe({
            next: (res: any) => {

                this.workflows = res;

                this.loadingWorkflows = false;
                this.divToShow = 3;
            },
            error: (err: any) => {
                console.error(err);
                this.loadingWorkflows = false;
            }
        });

    }


    backPage() {
        this.divToShow--;
    }

    setSource(val: any) {
        this.source = val;
    }


    setCloud(val: any) {

        this.cloud = val;
        this.deployment = null;

        if (val === 'AWS') {
            this.deploymentOptions = [
                'ECS Fargate',
                'EKS',
                'EC2',
                'Lambda'
            ];
            this.ecsOptions = [
                'acp-ecs-cluster-dev',
                'acp-ecs-cluster-qa',
                'acp-ecs-cluster-prod'
            ];
        }

        if (val === 'Azure') {
            this.deploymentOptions = [
                'Container Apps',
                'AKS',
                'App Service'
            ];
        }

        if (val === 'GCP') {
            this.deploymentOptions = [
                'Cloud Run',
                'GKE',
                'Compute Engine'
            ];
        }
    }


    setType(val: any) {
        this.deployment = val;
    }

    deploy() {
        if (this.isAcpAwsEcsFlow()) {
            const reviewPayload = {
                source: this.source,
                deploymentMode: this.deploymentMode,
                cloud: this.cloud,
                deployment: this.deployment,
                account: this.account,
                region: this.region,
                ecsCluster: this.ecsCluster,
                repoUrl: this.repoUrl,
                branch: this.branch,
                repoType: this.repoType,
                appName: this.appName,
                containerName: this.containerName,
                containerPort: this.containerPort,
                cpu: this.cpu,
                memory: this.memory,
                ecrRepository: this.ecrRepository,
                ecrImageTag: this.ecrImageTag
            };

            console.log('ACP AWS ECS deploy config:', reviewPayload);
            alert('Frontend flow is ready. Backend API integration for ACP ECS deploy is pending.');
            return;
        }

        if (!this.selectedWorkflow) {
            alert('Please select a workflow');
            return;
        }

        const payload: any = {
            repoUrl: this.repoUrl,
            branch: this.branch,
            workflowId: this.selectedWorkflow.id
        };

        if (this.githubToken) {
            payload.token = this.githubToken;
        }

        this.http.post(this.apiBase + 'github/workflows/trigger', payload)
            .subscribe({
                next: (res: any) => {

                    this.loadingSteps = false;

                    // ADD — Get runId from GitHub trigger response
                    const runId = res?.runId;

                    // Parse repo url
                    let account = '';
                    let repoName = '';

                    if (this.repoUrl) {
                        const cleaned = this.repoUrl
                            .replace('https://github.com/', '')
                            .replace('.git', '')
                            .replace(/\/$/, '');

                        const parts = cleaned.split('/');

                        account = parts[0];
                        repoName = parts[1];
                    }

                    const deploymentPayload = {
                        name: this.appName || this.selectedWorkflow.name,
                        cloud: this.cloud,
                        repoUrl: this.repoUrl,
                        repoName: repoName,
                        account: account,
                        branch: this.branch,
                        workflow: this.selectedWorkflow.name,
                        runId: runId, // ADD
                        status: 'running',
                        triggeredFrom: 'ACP Portal',
                        createdAt: new Date().toISOString()
                    };

                    // Create deployment record
                    this.http.post(this.apiBase + 'deployments/create', deploymentPayload)
                        .subscribe({
                            next: (response: any) => {

                                const deploymentId = response?.id;

                                // Navigate AFTER record creation
                                this.router.navigate(['/automation-logs'], {
                                    state: {
                                        repoUrl: this.repoUrl,
                                        workflow: this.selectedWorkflow.id,
                                        branch: this.branch,
                                        token: this.githubToken,
                                        deploymentId: deploymentId,
                                        runId: runId,
                                        appName: this.appName,
                                        cloud: this.cloud
                                    }
                                });

                            },
                            error: (err) => {

                                console.error('Deployment record failed', err);

                                // Still navigate (don't break flow)
                                this.router.navigate(['/automation-logs'], {
                                    state: {
                                        repoUrl: this.repoUrl,
                                        workflow: this.selectedWorkflow.id,
                                        branch: this.branch,
                                        token: this.githubToken,
                                        runId: runId,
                                        appName: this.appName,
                                        cloud: this.cloud
                                    }
                                });
                            }
                        });

                },
                error: (err: any) => {
                    console.error(err);
                    this.loadingSteps = false;
                    alert('Deployment failed');
                }
            });
    }

}