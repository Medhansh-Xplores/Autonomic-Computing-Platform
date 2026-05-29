const fs = require('fs');

let html = fs.readFileSync('src/app/automation-deployment/deploy-existing/deploy-existing.component.html', 'utf8');

// 1. Add Azure Target Details panels in Step 2 (just after AWS ECS flow)
const awsEcsBlockEnd = '                    <label for="useRds" class="form-label" style="margin:0;cursor:pointer;">Use RDS</label>\\n                </div>\\n\\n                <div class="form-group" *ngIf="useRds">\\n                    <label class="form-label">RDS Instance</label>\\n                    <div class="dropdown-with-loader">\\n                        <select class="usa-select" [(ngModel)]="rdsInstance" [disabled]="loadingRds || !region">\\n                            <option value="">{{ loadingRds ? \\'Loading RDS...\\' : \\'Select RDS Instance\\' }}</option>\\n                            <option *ngFor="let rds of rdsOptions" [value]="rds">{{ rds }}</option>\\n                        </select>\\n                        <div *ngIf="loadingRds" class="small-spinner"></div>\\n                    </div>\\n                </div>\\n\\n            </div>\\n        </div>';

if (html.includes(awsEcsBlockEnd)) {
    const azureStep2 = `

        <!-- ACP Azure: Shared Account + Region (all Azure ACP flows) -->
        <div *ngIf="isAnyAzureAcpFlow()" class="form-panel">
            <div class="form-panel-header">Azure Account & Region</div>
            <div class="form-panel-body">
                <div class="form-group">
                    <label class="form-label">Azure Account (Subscription)</label>
                    <div class="dropdown-with-loader">
                        <select class="usa-select" [(ngModel)]="azureAccount"
                            [disabled]="loadingAzureAccounts || !azureAccountOptions.length"
                            (change)="loadAzureRegions()">
                            <option value="">
                                {{ loadingAzureAccounts ? 'Loading accounts...' :
                                (azureAccountOptions.length ? 'Select Azure Account' : 'No Azure accounts available') }}
                            </option>
                            <option *ngFor="let acc of azureAccountOptions" [value]="acc.accountId">
                                {{ acc.accountName }} ({{ acc.accountId }})
                            </option>
                        </select>
                        <div *ngIf="loadingAzureAccounts" class="small-spinner"></div>
                    </div>
                </div>

                <div class="form-group">
                    <label class="form-label">Location (Region)</label>
                    <div class="dropdown-with-loader">
                        <select class="usa-select" [(ngModel)]="region"
                            [disabled]="loadingAzureRegions || !azureAccount"
                            (change)="loadContainerAppEnvironments(); loadAksClusters(); loadAppServicePlans()">
                            <option value="">
                                {{ loadingAzureRegions ? 'Loading regions...' : (azureAccount ? 'Select Region' : 'Select account first') }}
                            </option>
                            <option *ngFor="let r of azureRegionOptions" [value]="r">{{ r }}</option>
                        </select>
                        <div *ngIf="loadingAzureRegions" class="small-spinner"></div>
                    </div>
                </div>
            </div>
        </div>

        <!-- ACP Azure Container Apps: Environment picker -->
        <div *ngIf="isAcpAzureContainerAppsFlow()" class="form-panel">
            <div class="form-panel-header">Container App Environment</div>
            <div class="form-panel-body">
                <div class="form-group">
                    <label class="form-label">Container App Environment</label>
                    <div class="dropdown-with-loader">
                        <select class="usa-select" [(ngModel)]="selectedContainerAppEnvironment"
                            [disabled]="loadingContainerAppEnvironments || !region">
                            <option value="">
                                {{ loadingContainerAppEnvironments ? 'Loading environments...' :
                                   (region ? (containerAppEnvironments.length ? 'Select Environment' : 'No environments found') : 'Select region first') }}
                            </option>
                            <option *ngFor="let env of containerAppEnvironments" [value]="env.name">
                                {{ env.name }} ({{ env.resourceGroup }})
                            </option>
                        </select>
                        <div *ngIf="loadingContainerAppEnvironments" class="small-spinner"></div>
                    </div>
                </div>
            </div>
        </div>

        <!-- ACP Azure AKS: Cluster picker -->
        <div *ngIf="isAcpAzureAksFlow()" class="form-panel">
            <div class="form-panel-header">AKS Cluster</div>
            <div class="form-panel-body">
                <div class="form-group">
                    <label class="form-label">AKS Cluster</label>
                    <div class="dropdown-with-loader">
                        <select class="usa-select" [(ngModel)]="selectedAksCluster"
                            [disabled]="loadingAksClusters || !region"
                            (change)="selectedAksResourceGroup = (aksClusters | json).includes(selectedAksCluster) ? '' : ''">
                            <option value="">
                                {{ loadingAksClusters ? 'Loading AKS clusters...' :
                                   (region ? (aksClusters.length ? 'Select AKS Cluster' : 'No clusters found') : 'Select region first') }}
                            </option>
                            <option *ngFor="let c of aksClusters" [value]="c.name">
                                {{ c.name }} ({{ c.resourceGroup }})
                            </option>
                        </select>
                        <div *ngIf="loadingAksClusters" class="small-spinner"></div>
                    </div>
                </div>
            </div>
        </div>

        <!-- ACP Azure App Service: Plan picker -->
        <div *ngIf="isAcpAzureAppServiceFlow()" class="form-panel">
            <div class="form-panel-header">App Service Plan</div>
            <div class="form-panel-body">
                <div class="form-group">
                    <label class="form-label">App Service Plan</label>
                    <div class="dropdown-with-loader">
                        <select class="usa-select" [(ngModel)]="selectedAppServicePlan"
                            [disabled]="loadingAppServicePlans || !region">
                            <option value="">
                                {{ loadingAppServicePlans ? 'Loading plans...' :
                                   (region ? (appServicePlans.length ? 'Select App Service Plan' : 'No plans found') : 'Select region first') }}
                            </option>
                            <option *ngFor="let p of appServicePlans" [value]="p.name">
                                {{ p.name }} ({{ p.sku }}) — {{ p.resourceGroup }}
                            </option>
                        </select>
                        <div *ngIf="loadingAppServicePlans" class="small-spinner"></div>
                    </div>
                </div>
            </div>
        </div>
`;
    html = html.replace(awsEcsBlockEnd, awsEcsBlockEnd + azureStep2);
}

// 2. Hide non-ACP panels for Azure ACP flows
html = html.replace(
    /\*ngIf="source === 'GitHub' && !isAcpAwsEcsFlow\(\)"/g,
    `*ngIf="source === 'GitHub' && !isAcpAwsEcsFlow() && !isAnyAzureAcpFlow()"`
);

// 3. Update the Nav Button in Step 2 to also trigger for Azure ACP
html = html.replace(
    /<button class="custombutton" \*ngIf="!isAcpAwsEcsFlow\(\) && !isAnyAzureAcpFlow\(\)" \(click\)="deploy\(\)">Deploy<\/button>\\s*<button class="custombutton" \*ngIf="isAcpAwsEcsFlow\(\) \|\| isAnyAzureAcpFlow\(\)" \(click\)="nextPage\(\)">Next<\/button>/g,
    `<button class="custombutton" *ngIf="!isAcpAwsEcsFlow() && !isAnyAzureAcpFlow()" (click)="deploy()">Deploy</button>
                <button class="custombutton" *ngIf="isAcpAwsEcsFlow() || isAnyAzureAcpFlow()" (click)="nextPage()">Next</button>`
);
// In case the previous replace didn't work (if it was reverted completely)
html = html.replace(
    /<button class="custombutton" \*ngIf="!isAcpAwsEcsFlow\(\)" \(click\)="deploy\(\)">Deploy<\/button>\\s*<button class="custombutton" \*ngIf="isAcpAwsEcsFlow\(\)" \(click\)="nextPage\(\)">Next<\/button>/g,
    `<button class="custombutton" *ngIf="!isAcpAwsEcsFlow() && !isAnyAzureAcpFlow()" (click)="deploy()">Deploy</button>
                <button class="custombutton" *ngIf="isAcpAwsEcsFlow() || isAnyAzureAcpFlow()" (click)="nextPage()">Next</button>`
);

// 4. Update Step 3 to include unified Azure GitHub details (mirrors AWS ECS)
const awsEcsStep3End = `        <!-- ACP AWS ECS: GitHub Details -->
        <div *ngIf="isAcpAwsEcsFlow()" class="form-panel">
            <div class="form-panel-header">GitHub Details</div>
            <div class="form-panel-body">

                <div class="form-group">
                    <label class="form-label">Repository URL</label>
                    <input type="text" class="usa-input" [(ngModel)]="repoUrl"
                        placeholder="https://github.com/org/repo">
                </div>

                <div class="form-row-2">
                    <div class="form-group">
                        <label class="form-label">Branch</label>
                        <input type="text" class="usa-input" [(ngModel)]="branch" placeholder="main">
                    </div>
                    <div class="form-group">
                        <label class="form-label">GitHub Token <span style="color:red">*</span></label>
                        <input type="password" class="usa-input" [(ngModel)]="githubToken"
                            placeholder="GitHub PAT with repo workflow scopes">
                    </div>
                </div>

            </div>
        </div>`;

const azureStep3 = `
        <!-- ACP: GitHub Details (all Azure ACP flows) -->
        <div *ngIf="isAnyAzureAcpFlow()" class="form-panel">
            <div class="form-panel-header">GitHub Details</div>
            <div class="form-panel-body">
                <div class="form-group">
                    <label class="form-label">Application Repository URL</label>
                    <input type="text" class="usa-input" [(ngModel)]="repoUrl"
                        placeholder="https://github.com/org/repo  or  .../tree/main/subfolder">
                    <div class="field-hint">Paste a full repo URL or a /tree/branch/subfolder URL — branch and paths are detected automatically.</div>
                </div>
                <div class="form-row-2">
                    <div class="form-group">
                        <label class="form-label">Frontend Codebase Path</label>
                        <input type="text" class="usa-input" [(ngModel)]="frontendPath"
                            placeholder="frontend (subfolder with Dockerfile)">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Backend Codebase Path</label>
                        <input type="text" class="usa-input" [(ngModel)]="backendPath"
                            placeholder="backend (subfolder with Dockerfile)">
                    </div>
                </div>
            </div>
        </div>
        <!-- ACP: Repository Access (Azure flows) -->
        <div *ngIf="isAnyAzureAcpFlow()" class="form-panel">
            <div class="form-panel-header">Repository Access</div>
            <div class="form-panel-body">
                <div class="form-group">
                    <label class="form-label">Repository Type</label>
                    <label class="radio-option">
                        <input type="radio" name="azureRepoType" (change)="azureRepoType='public'">
                        Public Repository
                    </label>
                    <label class="radio-option">
                        <input type="radio" name="azureRepoType" (change)="azureRepoType='private'">
                        Private Repository
                    </label>
                </div>
            </div>
        </div>
        <!-- ACP: GitHub Token (Azure private repos) -->
        <div *ngIf="isAnyAzureAcpFlow()" class="form-panel">
            <div class="form-panel-header">Authentication</div>
            <div class="form-panel-body">
                <div class="form-group">
                    <label class="form-label">GitHub Token <span style="color:red">*</span></label>
                    <input type="password" class="usa-input" [(ngModel)]="githubToken"
                        placeholder="GitHub Personal Access Token (repo + workflow scopes)">
                    <div *ngIf="azureRepoType === 'public'" class="field-hint">Required to commit the workflow file to your repository.</div>
                </div>
            </div>
        </div>
`;
if (html.includes(awsEcsStep3End)) {
    html = html.replace(awsEcsStep3End, awsEcsStep3End + azureStep3);
}

// 5. Update Step 4 Application Configuration for Azure Targets
const awsEcsStep4End = `                    </div>
                </div>

                <div class="form-group">
                    <label class="form-label">Frontend Base Path <span class="field-hint">(Optional)</span></label>
                    <input type="text" class="usa-input" [(ngModel)]="frontendBasePath" placeholder="/tasks">
                </div>
            </div>
        </div>`;

const azureStep4 = `
        <!-- ACP Azure Container Apps: Config -->
        <div *ngIf="isAcpAzureContainerAppsFlow()" class="form-panel">
            <div class="form-panel-header">Azure Container Apps Configuration</div>
            <div class="form-panel-body">
                <div class="form-group">
                    <label class="form-label">Application Name</label>
                    <input type="text" class="usa-input" [(ngModel)]="appName">
                </div>
                <div class="form-group">
                    <label class="form-label">Container App Name <span class="field-hint">(Optional — defaults to app name)</span></label>
                    <input type="text" class="usa-input" [(ngModel)]="containerAppName" placeholder="my-container-app">
                </div>
                <div class="form-group">
                    <label class="form-label">ACR Name <span class="field-hint">(Optional)</span></label>
                    <input type="text" class="usa-input" [(ngModel)]="acrName" (input)="onAcrNameChange()" placeholder="Leave blank to auto-generate">
                    <div *ngIf="checkingAcrName" class="field-hint" style="color:blue">Checking availability...</div>
                    <div *ngIf="acrNameAvailable === true" class="field-hint" style="color:green">✔ Name is available</div>
                    <div *ngIf="acrNameAvailable === false" class="field-error">✖ {{ acrNameError }}</div>
                </div>
                <div class="form-row-2">
                    <div class="form-group">
                        <label class="form-label">Port</label>
                        <input type="text" class="usa-input" [(ngModel)]="azurePort" placeholder="80">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Frontend Base Path</label>
                        <input type="text" class="usa-input" [(ngModel)]="frontendBasePath" placeholder="/tasks">
                    </div>
                </div>
                <div class="form-row-2">
                    <div class="form-group">
                        <label class="form-label">CPU (cores)</label>
                        <select class="usa-select" [(ngModel)]="cpu">
                            <option value="0.25">0.25</option>
                            <option value="0.5">0.5</option>
                            <option value="1">1</option>
                            <option value="2">2</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Memory (Gi)</label>
                        <select class="usa-select" [(ngModel)]="memory">
                            <option value="0.5">0.5</option>
                            <option value="1">1</option>
                            <option value="2">2</option>
                            <option value="4">4</option>
                        </select>
                    </div>
                </div>
            </div>
        </div>

        <!-- ACP Azure AKS: Config -->
        <div *ngIf="isAcpAzureAksFlow()" class="form-panel">
            <div class="form-panel-header">Azure AKS Deployment Configuration</div>
            <div class="form-panel-body">
                <div class="form-group">
                    <label class="form-label">Application Name</label>
                    <input type="text" class="usa-input" [(ngModel)]="appName">
                </div>
                <div class="form-group">
                    <label class="form-label">Kubernetes Namespace <span class="field-hint">(Optional)</span></label>
                    <input type="text" class="usa-input" [(ngModel)]="azureNamespace" placeholder="default">
                </div>
                <div class="form-group">
                    <label class="form-label">ACR Name <span class="field-hint">(Optional)</span></label>
                    <input type="text" class="usa-input" [(ngModel)]="acrName" (input)="onAcrNameChange()" placeholder="Leave blank to auto-generate">
                    <div *ngIf="checkingAcrName" class="field-hint" style="color:blue">Checking availability...</div>
                    <div *ngIf="acrNameAvailable === true" class="field-hint" style="color:green">✔ Name is available</div>
                    <div *ngIf="acrNameAvailable === false" class="field-error">✖ {{ acrNameError }}</div>
                </div>
                <div class="form-group">
                    <label class="form-label">Port</label>
                    <input type="text" class="usa-input" [(ngModel)]="azurePort" placeholder="80">
                </div>
            </div>
        </div>

        <!-- ACP Azure App Service: Config -->
        <div *ngIf="isAcpAzureAppServiceFlow()" class="form-panel">
            <div class="form-panel-header">Azure App Service Configuration</div>
            <div class="form-panel-body">
                <div class="form-group">
                    <label class="form-label">Application Name</label>
                    <input type="text" class="usa-input" [(ngModel)]="appName">
                </div>
                <div class="form-group">
                    <label class="form-label">App Service Name <span class="field-hint">(Optional — defaults to app name)</span></label>
                    <input type="text" class="usa-input" [(ngModel)]="containerAppName" placeholder="my-app-service">
                </div>
                <div class="form-group">
                    <label class="form-label">ACR Name <span class="field-hint">(Optional)</span></label>
                    <input type="text" class="usa-input" [(ngModel)]="acrName" (input)="onAcrNameChange()" placeholder="Leave blank to auto-generate">
                    <div *ngIf="checkingAcrName" class="field-hint" style="color:blue">Checking availability...</div>
                    <div *ngIf="acrNameAvailable === true" class="field-hint" style="color:green">✔ Name is available</div>
                    <div *ngIf="acrNameAvailable === false" class="field-error">✖ {{ acrNameError }}</div>
                </div>
                <div class="form-group">
                    <label class="form-label">Port</label>
                    <input type="text" class="usa-input" [(ngModel)]="azurePort" placeholder="80">
                </div>
            </div>
        </div>
`;
if (html.includes(awsEcsStep4End)) {
    html = html.replace(awsEcsStep4End, awsEcsStep4End + azureStep4);
}

// 6. Update Step 5 Review rows for Azure targets
const reviewTableRegex = /<tr \*ngIf="isAcpAwsEcsFlow\(\)">\s*<td>Account<\/td>/;
if (reviewTableRegex.test(html)) {
    const azureReviewRows = `
                    <tr *ngIf="isAnyAzureAcpFlow()">
                        <td>Azure Account</td>
                        <td>{{azureAccount}}</td>
                    </tr>
                    <tr *ngIf="isAnyAzureAcpFlow()">
                        <td>Region</td>
                        <td>{{region}}</td>
                    </tr>
                    <tr *ngIf="isAnyAzureAcpFlow()">
                        <td>Repository</td>
                        <td>{{repoUrl}} ({{branch}})</td>
                    </tr>
                    <tr *ngIf="isAnyAzureAcpFlow()">
                        <td>Frontend Path</td>
                        <td>{{frontendPath}}</td>
                    </tr>
                    <tr *ngIf="isAnyAzureAcpFlow()">
                        <td>Backend Path</td>
                        <td>{{backendPath}}</td>
                    </tr>
                    <tr *ngIf="isAnyAzureAcpFlow() && acrName">
                        <td>ACR Name</td>
                        <td>{{acrName}}</td>
                    </tr>
                    <tr *ngIf="isAcpAzureContainerAppsFlow() && selectedContainerAppEnvironment">
                        <td>Container App Environment</td>
                        <td>{{selectedContainerAppEnvironment}}</td>
                    </tr>
                    <tr *ngIf="isAcpAzureAksFlow() && selectedAksCluster">
                        <td>AKS Cluster</td>
                        <td>{{selectedAksCluster}}</td>
                    </tr>
                    <tr *ngIf="isAcpAzureAksFlow()">
                        <td>Namespace</td>
                        <td>{{azureNamespace || 'default'}}</td>
                    </tr>
                    <tr *ngIf="isAcpAzureAppServiceFlow() && selectedAppServicePlan">
                        <td>App Service Plan</td>
                        <td>{{selectedAppServicePlan}}</td>
                    </tr>
`;
    html = html.replace(
        '<tr *ngIf="isAcpAwsEcsFlow()">\\r\\n                        <td>Account</td>',
        azureReviewRows + '<tr *ngIf="isAcpAwsEcsFlow()">\\r\\n                        <td>Account</td>'
    );
    // fallback for LF vs CRLF
    html = html.replace(
        '<tr *ngIf="isAcpAwsEcsFlow()">\\n                        <td>Account</td>',
        azureReviewRows + '<tr *ngIf="isAcpAwsEcsFlow()">\\n                        <td>Account</td>'
    );
}

fs.writeFileSync('src/app/automation-deployment/deploy-existing/deploy-existing.component.html', html);
console.log('HTML Patch Complete');
