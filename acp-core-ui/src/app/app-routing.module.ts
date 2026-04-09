import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { ApplicationResourcesComponent } from './application-resources/application-resources.component';
import { ApplicationServicesComponent } from './application-services/application-services.component';
import { CreateApplicationComponent } from './create-application/create-application.component';
import { CreateInfrastructureComponent } from './create-infrastructure/create-infrastructure.component';
import { InfrastructureResourcesComponent } from './infrastructure-resources/infrastructure-resources.component';
import { InfrastructureServicesComponent } from './infrastructure-services/infrastructure-services.component';
import { LoginComponent } from './login/login.component';
import { MainPageComponent } from './main-page/main-page.component';
import { TenantInfoComponent } from './tenant/tenant-info.component';
import { WizardComponent } from './wizard/wizard.component';
import { DeploymentLogsComponent } from './deployment-logs.component/deployment-logs.component';
import { AutomationDeploymentComponent } from './automation-deployment/automation-deployment.component';
import { SecurityComplianceComponent } from './security-compliance/security-compliance.component';
import { DeployExistingComponent } from './automation-deployment/deploy-existing/deploy-existing.component';
import { AutomationLogsComponent } from './automation-logs/automation-logs.component';
import { ViewDeploymentsComponent } from './automation-deployment/view-deployments/view-deployments.component';



const routes: Routes = [
  { path: '', component: LoginComponent },
  { path: 'services', component: MainPageComponent },
  { path: 'login', component: LoginComponent },
  { path: 'infraservices', component: InfrastructureServicesComponent },
  { path: 'CreateApplication', component: CreateApplicationComponent },
  { path: 'CreateInfrastructure', component: CreateInfrastructureComponent },
  { path: 'infrastructure-resources', component: InfrastructureResourcesComponent },
  { path: 'appservices', component: ApplicationServicesComponent },
  { path: 'ApplicationResources', component: ApplicationResourcesComponent },
  { path: 'tenant', component: TenantInfoComponent },
  { path: 'wizard', component: WizardComponent },
  { path: 'deployment-logs', component: DeploymentLogsComponent },
  { path: 'automation-deployment', component: AutomationDeploymentComponent },
  { path: 'security-compliance', component: SecurityComplianceComponent },
  { path: 'deploy-existing', component: DeployExistingComponent },
  { path: 'automation-logs', component: AutomationLogsComponent },
  { path: 'view-deployments', component: ViewDeploymentsComponent },
  { path: 'running-deployments', component: ViewDeploymentsComponent },
  
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }