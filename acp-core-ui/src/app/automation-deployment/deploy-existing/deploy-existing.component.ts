import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { EnvService } from 'src/environments/env.service';
import { Router } from '@angular/router';

@Component({
    selector: 'app-deploy-existing',
    templateUrl: './deploy-existing.component.html',
    styleUrls: ['./deploy-existing.component.css']
})
export class DeployExistingComponent implements OnInit {
    // Azure resource pickers
    azureRegionOptions: string[] = [];
    loadingAzureRegions = false;
    containerAppEnvironments: any[] = [];
    loadingContainerAppEnvironments = false;
    selectedContainerAppEnvironment: string = '';
    aksClusters: any[] = [];
    loadingAksClusters = false;
    selectedAksCluster: string = '';
    selectedAksResourceGroup: string = '';
    appServicePlans: any[] = [];
    loadingAppServicePlans = false;
    selectedAppServicePlan: string = '';
    azureRepoType: string = 'public';
    azureNamespace: string = 'default';
    azureAccountOptions: any[] = [];
    azureAccount: any;
    loadingAzureAccounts = false;
    containerAppName: any;
    acrName: any;
    azurePort: any = '80';


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

    ngOnInit() {
        this.loadAccounts();
    }

    divToShow = 1;
    apiBase = this.envService.apiUrl;

    cpu: any;
    memory: any;
    port: any;
    source: any;
    cloud: any;
    deployment: any;
    deploymentOptions: any[] = [];
    appName: any;
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
    accountOptions: any[] = [];
    regionOptions: any[] = [];
    loadingAccounts = false;
    loadingRegions = false;
    loadingEcs = false;
    loading = false;
    loadingWorkflows = false;
    loadingSteps = false;
    frontendPath: any = 'frontend';
    backendPath: any = 'backend';
    rdsInstance: any;
    rdsOptions: any[] = [];
    loadingRds = false;
    useRds = false;
    backendPort: any = '3000';
    healthCheckPath: string = '/health';
    apiPath: string = '/api/*';
    priority: number = 100;
    takenPriorities: { priority: number, path: string }[] = [];
    frontendBasePath: string = '';

    isAcpAwsEcsFlow(): boolean {
        return this.source === 'GitHub'
            && this.deploymentMode === 'acp'
            && this.cloud === 'AWS'
            && this.deployment === 'ECS Fargate';
    }

    
    isAcpAzureContainerAppsFlow(): boolean {
        return this.source === 'GitHub' && this.deploymentMode === 'acp' && this.cloud === 'Azure' && this.deployment === 'Container Apps';
    }
    isAcpAzureAppServiceFlow(): boolean {
        return this.source === 'GitHub' && this.deploymentMode === 'acp' && this.cloud === 'Azure' && this.deployment === 'App Service';
    }
    isAcpAzureAksFlow(): boolean {
        return this.source === 'GitHub' && this.deploymentMode === 'acp' && this.cloud === 'Azure' && this.deployment === 'AKS';
    }
    isAnyAzureAcpFlow(): boolean {
        return this.isAcpAzureContainerAppsFlow() || this.isAcpAzureAppServiceFlow() || this.isAcpAzureAksFlow();
    }
    loadAzureAccounts() {
        this.loadingAzureAccounts = true;
        this.http.get(this.apiBase + 'azure/accounts').subscribe({
            next: (res: any) => { this.azureAccountOptions = res || []; this.loadingAzureAccounts = false; },
            error: (err) => { console.error(err); this.loadingAzureAccounts = false; }
        });
    }
    loadAzureRegions() {
        this.azureRegionOptions = []; this.containerAppEnvironments = []; this.aksClusters = []; this.appServicePlans = [];
        this.selectedContainerAppEnvironment = ''; this.selectedAksCluster = ''; this.selectedAppServicePlan = '';
        this.region = null; this.loadingAzureRegions = true;
        this.http.get(this.apiBase + 'azure/regions').subscribe({
            next: (res: any) => { this.azureRegionOptions = res; this.loadingAzureRegions = false; },
            error: (err) => { console.error(err); this.loadingAzureRegions = false; }
        });
    }
    loadContainerAppEnvironments() {
        if (!this.azureAccount || !this.region) return;
        this.selectedContainerAppEnvironment = ''; this.containerAppEnvironments = []; this.loadingContainerAppEnvironments = true;
        this.http.get(this.apiBase + 'azure/container-app-environments?account=' + this.azureAccount + '&region=' + this.region).subscribe({
            next: (res: any) => { this.containerAppEnvironments = res; this.loadingContainerAppEnvironments = false; },
            error: (err) => { console.error(err); this.loadingContainerAppEnvironments = false; }
        });
    }
    loadAksClusters() {
        if (!this.azureAccount || !this.region) return;
        this.selectedAksCluster = ''; this.aksClusters = []; this.loadingAksClusters = true;
        this.http.get(this.apiBase + 'azure/aks-clusters?account=' + this.azureAccount + '&region=' + this.region).subscribe({
            next: (res: any) => { this.aksClusters = res; this.loadingAksClusters = false; },
            error: (err) => { console.error(err); this.loadingAksClusters = false; }
        });
    }
    onAksClusterChange() {
        const selected = this.aksClusters.find(c => c.name === this.selectedAksCluster);
        if (selected) {
            this.selectedAksResourceGroup = selected.resourceGroup;
        } else {
            this.selectedAksResourceGroup = '';
        }
    }
    loadAppServicePlans() {
        if (!this.azureAccount || !this.region) return;
        this.selectedAppServicePlan = ''; this.appServicePlans = []; this.loadingAppServicePlans = true;
        this.http.get(this.apiBase + 'azure/app-service-plans?account=' + this.azureAccount + '&region=' + this.region).subscribe({
            next: (res: any) => { this.appServicePlans = res; this.loadingAppServicePlans = false; },
            error: (err) => { console.error(err); this.loadingAppServicePlans = false; }
        });
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
                if (!this.account || !this.region || !this.ecsCluster || (this.useRds && !this.rdsInstance)) {
                    alert('Please select Account, Region and ECS Cluster');
                    return;
                }
                this.divToShow++;
                return;
            }

            if (this.divToShow === 3) {
                if (!this.repoUrl) {
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

                if (!this.appName || !this.backendPort) {
                    alert('Please fill application configuration');
                    return;
                }

                if (this.frontendBasePath && !this.frontendBasePath.startsWith('/')) {
                    alert('Frontend base path must start with /');
                    return;
                }

                // ✅ ADD THIS BLOCK
                if (this.isPriorityTaken()) {
                    alert(`Priority ${this.priority} is already taken. Please choose a different one.`);
                    return;
                }

                this.divToShow++;
                return;
            }
        }

        
        if (this.isAcpAzureContainerAppsFlow()) {
            if (this.divToShow === 2) {
                if (!this.azureAccount || !this.region || !this.selectedContainerAppEnvironment) { alert('Please select Account, Region and Environment'); return; }
                this.divToShow++; return;
            }
            if (this.divToShow === 3) {
                if (!this.repoUrl) { alert('Please fill GitHub Repository URL'); return; }
                if (this.azureRepoType === 'private' && !this.githubToken) { alert('Please provide GitHub token for private repo'); return; }
                if (!this.githubToken) { alert('Please provide GitHub token'); return; }
                this.divToShow++; return;
            }
            if (this.divToShow === 4) {
                if (!this.appName) { alert('Please fill Application Name'); return; }
                if (this.acrName && (this.acrNameAvailable === false || !/^[a-zA-Z0-9]{3,24}$/.test(this.acrName))) { alert('Invalid ACR Name'); return; }
                this.divToShow++; return;
            }
        }
        if (this.isAcpAzureAksFlow()) {
            if (this.divToShow === 2) {
                if (!this.azureAccount || !this.region || !this.selectedAksCluster) { alert('Please select Account, Region and AKS Cluster'); return; }
                this.divToShow++; return;
            }
            if (this.divToShow === 3) {
                if (!this.repoUrl) { alert('Please fill GitHub Repository URL'); return; }
                if (this.azureRepoType === 'private' && !this.githubToken) { alert('Please provide GitHub token for private repo'); return; }
                if (!this.githubToken) { alert('Please provide GitHub token'); return; }
                this.divToShow++; return;
            }
            if (this.divToShow === 4) {
                if (!this.appName) { alert('Please fill Application Name'); return; }
                if (this.acrName && (this.acrNameAvailable === false || !/^[a-zA-Z0-9]{3,24}$/.test(this.acrName))) { alert('Invalid ACR Name'); return; }
                this.divToShow++; return;
            }
        }
        if (this.isAcpAzureAppServiceFlow()) {
            if (this.divToShow === 2) {
                if (!this.azureAccount || !this.region || !this.selectedAppServicePlan) { alert('Please select Account, Region and App Service Plan'); return; }
                this.divToShow++; return;
            }
            if (this.divToShow === 3) {
                if (!this.repoUrl) { alert('Please fill GitHub Repository URL'); return; }
                if (this.azureRepoType === 'private' && !this.githubToken) { alert('Please provide GitHub token for private repo'); return; }
                if (!this.githubToken) { alert('Please provide GitHub token'); return; }
                this.divToShow++; return;
            }
            if (this.divToShow === 4) {
                if (!this.appName) { alert('Please fill Application Name'); return; }
                if (this.acrName && (this.acrNameAvailable === false || !/^[a-zA-Z0-9]{3,24}$/.test(this.acrName))) { alert('Invalid ACR Name'); return; }
                this.divToShow++; return;
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

            this.loadAccounts();
        }

        if (val === 'Azure') {
            this.deploymentOptions = ['Container Apps', 'AKS', 'App Service'];
            this.loadAzureAccounts();
            this.region = null;
            this.azureRegionOptions = [];
            this.containerAppEnvironments = [];
            this.aksClusters = [];
            this.appServicePlans = [];
            this.selectedContainerAppEnvironment = '';
            this.selectedAksCluster = '';
            this.selectedAppServicePlan = '';
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
        const _azureTreeMatch = (this.repoUrl || '').match(/^(https:\/\/github\.com\/[^\/]+\/[^\/]+)\/tree\/([^\/]+)\/(.+)$/);
        const _azureBaseRepoUrl  = _azureTreeMatch ? _azureTreeMatch[1] : this.repoUrl;
        const _azureResolvedBranch = _azureTreeMatch ? _azureTreeMatch[2] : (this.branch || 'main');
        const _azureAppSubfolder   = _azureTreeMatch ? _azureTreeMatch[3] : '';
        const _azureResolvedFrontendPath = _azureAppSubfolder ? _azureAppSubfolder + '/' + (this.frontendPath || 'frontend') : (this.frontendPath || 'frontend');
        const _azureResolvedBackendPath = _azureAppSubfolder ? _azureAppSubfolder + '/' + (this.backendPath || 'backend') : (this.backendPath || 'backend');

        if (this.isAcpAzureAksFlow()) {
            this.loading = true;
            const safeAppName = (this.appName || 'app').toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
            const workflowName = 'deploy-' + safeAppName + '-aks.yml';
            const payload = {
                repoUrl: _azureBaseRepoUrl, branch: _azureResolvedBranch, token: this.githubToken,
                frontendPath: _azureResolvedFrontendPath, backendPath: _azureResolvedBackendPath,
                account: this.azureAccount, acrName: this.acrName, appName: this.appName,
                aksCluster: this.selectedAksCluster, aksResourceGroup: this.selectedAksResourceGroup,
                region: this.region, port: this.azurePort, namespace: this.azureNamespace
            };
            this.http.post(this.apiBase + 'github/deploy-azure-aks', payload).subscribe({
                next: (res: any) => {
                    this.loading = false;
                    this.router.navigate(['/automation-logs'], {
                        state: res.provisioning ? { phase: 'provisioning', appName: this.appName, repoUrl: _azureBaseRepoUrl, branch: _azureResolvedBranch, token: this.githubToken, cloud: 'Azure', workflow: workflowName, deploymentMode: 'acp' } : { phase: 'github', repoUrl: _azureBaseRepoUrl, workflow: workflowName, branch: _azureResolvedBranch, token: this.githubToken, deploymentId: res.deploymentId, runId: res.runId, appName: this.appName, cloud: 'Azure' }
                    });
                },
                error: (err: any) => { this.loading = false; alert('Deployment failed'); }
            });
            return;
        }

        if (this.isAcpAzureAppServiceFlow()) {
            this.loading = true;
            const safeAppName = (this.appName || 'app').toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
            const workflowName = 'deploy-' + safeAppName + '.yml';
            const payload = {
                repoUrl: _azureBaseRepoUrl, branch: _azureResolvedBranch, token: this.githubToken,
                frontendPath: _azureResolvedFrontendPath, backendPath: _azureResolvedBackendPath,
                account: this.azureAccount, acrName: this.acrName, appName: this.appName,
                appServiceName: this.containerAppName || safeAppName, appServicePlan: this.selectedAppServicePlan,
                region: this.region, port: this.azurePort
            };
            this.http.post(this.apiBase + 'github/deploy-azure-app-service', payload).subscribe({
                next: (res: any) => {
                    this.loading = false;
                    this.router.navigate(['/automation-logs'], {
                        state: res.provisioning ? { phase: 'provisioning', appName: this.appName, repoUrl: _azureBaseRepoUrl, branch: _azureResolvedBranch, token: this.githubToken, cloud: 'Azure', workflow: workflowName, deploymentMode: 'acp' } : { phase: 'github', repoUrl: _azureBaseRepoUrl, workflow: workflowName, branch: _azureResolvedBranch, token: this.githubToken, deploymentId: res.deploymentId, runId: res.runId, appName: this.appName, cloud: 'Azure' }
                    });
                },
                error: (err: any) => { this.loading = false; alert('Deployment failed'); }
            });
            return;
        }

        if (this.isAcpAzureContainerAppsFlow()) {
            this.loading = true;
            const safeAppName = (this.appName || 'app').toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
            const workflowName = 'deploy-' + safeAppName + '.yml';
            const payload = {
                repoUrl: _azureBaseRepoUrl, branch: _azureResolvedBranch, token: this.githubToken,
                frontendPath: _azureResolvedFrontendPath, backendPath: _azureResolvedBackendPath,
                account: this.azureAccount, acrName: this.acrName, appName: this.appName,
                containerAppName: this.containerAppName || safeAppName, containerAppEnvironment: this.selectedContainerAppEnvironment,
                region: this.region, port: this.azurePort, cpu: this.cpu, memory: this.memory, frontendBasePath: this.frontendBasePath
            };
            this.http.post(this.apiBase + 'github/deploy-azure-container-apps', payload).subscribe({
                next: (res: any) => {
                    this.loading = false;
                    this.router.navigate(['/automation-logs'], {
                        state: res.provisioning ? { phase: 'provisioning', appName: this.appName, repoUrl: _azureBaseRepoUrl, branch: _azureResolvedBranch, token: this.githubToken, cloud: 'Azure', workflow: workflowName, deploymentMode: 'acp' } : { phase: 'github', repoUrl: _azureBaseRepoUrl, workflow: workflowName, branch: _azureResolvedBranch, token: this.githubToken, deploymentId: res.deploymentId, runId: res.runId, appName: this.appName, cloud: 'Azure' }
                    });
                },
                error: (err: any) => { this.loading = false; alert('Deployment failed'); }
            });
            return;
        }

        if (this.isAcpAwsEcsFlow()) {
            this.loading = true;

            // Parse subfolder URL like:
            // https://github.com/ORG/REPO/tree/BRANCH/path/to/app
            let baseRepoUrl = this.repoUrl;
            let appSubfolder = '';
            let resolvedBranch = 'main';   // sensible default

            const treeMatch = this.repoUrl?.match(
                /^(https:\/\/github\.com\/[^\/]+\/[^\/]+)\/tree\/([^\/]+)\/(.+)$/
            );
            if (treeMatch) {
                baseRepoUrl = treeMatch[1];
                resolvedBranch = treeMatch[2];   // extracted from URL — most accurate
                appSubfolder = treeMatch[3];
            }

            const resolvedFrontendPath = appSubfolder
                ? `${appSubfolder}/${this.frontendPath}`
                : this.frontendPath;

            const resolvedBackendPath = appSubfolder
                ? `${appSubfolder}/${this.backendPath}`
                : this.backendPath;

            const payload = {
                repoUrl: baseRepoUrl,
                branch: resolvedBranch,
                token: this.githubToken,
                frontendPath: resolvedFrontendPath,
                backendPath: resolvedBackendPath,
                account: this.account,
                region: this.region,
                ecsCluster: this.ecsCluster,
                rdsName: this.useRds ? this.rdsInstance : null,
                useRds: this.useRds,
                appName: this.appName,
                backendPort: this.backendPort,
                healthCheckPath: this.healthCheckPath,
                apiPath: this.apiPath,
                priority: this.priority,
                frontendBasePath: this.frontendBasePath,
            };

            const safeAppName = (this.appName || 'app')
                .toLowerCase()
                .replace(/\s+/g, '-')
                .replace(/[^a-z0-9-]/g, '');

            const workflowName = `deploy-${safeAppName}.yml`;

            this.http.post(this.apiBase + 'github/deploy-ecs', payload)
                .subscribe({
                    next: (res: any) => {
                        this.loading = false;

                        if (res.provisioning) {
                            this.router.navigate(['/automation-logs'], {
                                state: {
                                    phase: 'provisioning',
                                    appName: this.appName,
                                    repoUrl: baseRepoUrl,
                                    branch: resolvedBranch,
                                    token: this.githubToken,
                                    cloud: 'AWS',
                                    workflow: workflowName,
                                    deploymentMode: 'acp'
                                }
                            });
                        } else {
                            const { runId, deploymentId } = res;
                            this.router.navigate(['/automation-logs'], {
                                state: {
                                    phase: 'github',
                                    repoUrl: baseRepoUrl,
                                    workflow: workflowName,
                                    branch: resolvedBranch,
                                    token: this.githubToken,
                                    deploymentId: deploymentId,
                                    runId: runId,
                                    appName: this.appName,
                                    cloud: 'AWS'
                                }
                            });
                        }
                    },
                    error: (err: any) => {
                        this.loading = false;
                        console.error('ECS deploy failed', err);
                        alert('Deployment failed: ' + (err?.error?.message || 'Unknown error'));
                    }
                });
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

                    const runId = res?.runId;

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
                        accountID: this.account,      // ← ADD: the AWS account ID
                        region: this.region,          // ← ADD
                        ecsCluster: this.ecsCluster,  // ← ADD
                        branch: this.branch,
                        workflow: this.selectedWorkflow.name,
                        runId: runId,
                        status: 'running',
                        triggeredFrom: 'ACP Portal',
                        createdAt: new Date().toISOString()
                    };

                    this.http.post(this.apiBase + 'deployments/create', deploymentPayload)
                        .subscribe({
                            next: (response: any) => {

                                const deploymentId = response?.id;

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

    // Load Accounts
    loadAccounts() {

        this.loadingAccounts = true;

        this.http.get(this.apiBase + 'aws/accounts')
            .subscribe({
                next: (res: any) => {
                    this.accountOptions = res;
                    this.loadingAccounts = false;
                },
                error: (err) => {
                    console.error('Failed to load accounts', err);
                    this.loadingAccounts = false;
                }
            });

    }


    // Load Regions
    loadRegions() {

        this.region = null;
        this.ecsCluster = null;
        this.regionOptions = [];
        this.ecsOptions = [];

        this.loadingRegions = true;

        this.http.get(
            this.apiBase + 'aws/regions?account=' + this.account
        ).subscribe({
            next: (res: any) => {
                this.regionOptions = res;
                this.loadingRegions = false;
            },
            error: (err) => {
                console.error('Failed to load regions', err);
                this.loadingRegions = false;
            }
        });

    }

    // Load ECS Clusters
    loadEcsClusters() {

        this.ecsCluster = null;
        this.ecsOptions = [];

        this.loadingEcs = true;

        this.http.get(
            this.apiBase + 'aws/ecs-clusters?account=' + this.account + '&region=' + this.region
        ).subscribe({
            next: (res: any) => {
                this.ecsOptions = res;
                this.loadingEcs = false;
            },
            error: (err) => {
                console.error('Failed to load ECS clusters', err);
                this.loadingEcs = false;
            }
        });

    }
    // Load RDS Instances
    loadRdsInstances() {

        this.rdsInstance = null;
        this.rdsOptions = [];

        this.loadingRds = true;

        this.http.get(
            this.apiBase + 'aws/rds-instances?account=' + this.account + '&region=' + this.region
        ).subscribe({
            next: (res: any) => {
                this.rdsOptions = res;
                this.loadingRds = false;
            },
            error: (err) => {
                console.error('Failed to load RDS', err);
                this.loadingRds = false;
            }
        });
    }

    loadListenerRules() {
        if (!this.account || !this.region || !this.ecsCluster) return;

        this.http.get(
            this.apiBase + `github/listener-rules?account=${this.account}&region=${this.region}&ecsCluster=${this.ecsCluster}`
        ).subscribe({
            next: (res: any) => {
                this.takenPriorities = res;
            },
            error: (err) => console.error('Failed to load listener rules', err)
        });
    }

    isPriorityTaken(): boolean {
        return this.takenPriorities.some(r => r.priority === +this.priority);
    }

    getTakenPath(): string {
        return this.takenPriorities.find(r => r.priority === +this.priority)?.path || '';
    }


    checkingAcrName = false;
    acrNameAvailable: boolean | null = null;
    acrNameError: string | null = null;
    acrNameTimeout: any;
    onAcrNameChange() {
        this.acrNameAvailable = null;
        this.acrNameError = null;
        if (!this.acrName) return;
        if (this.acrNameTimeout) clearTimeout(this.acrNameTimeout);
        this.acrNameTimeout = setTimeout(() => { this.checkAcrNameAvailability(); }, 500);
    }
    checkAcrNameAvailability() {
        if (!this.acrName || !this.azureAccount) return;
        this.checkingAcrName = true;
        this.http.get(`${this.apiBase}github/check-acr-name?account=${this.azureAccount}&name=${this.acrName}`).subscribe({
            next: (res: any) => { this.checkingAcrName = false; this.acrNameAvailable = res.nameAvailable; if (!res.nameAvailable) this.acrNameError = res.message || 'Already in use.'; },
            error: (err) => { this.checkingAcrName = false; console.error(err); }
        });
    }
}