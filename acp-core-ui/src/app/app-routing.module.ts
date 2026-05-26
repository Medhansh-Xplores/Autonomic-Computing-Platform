import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { AuthGuardService } from './helpers/auth-guard.service';

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
import { NewuserComponent } from './newuser/newuser.component';
import { ConfirmComponent } from './confirm/confirm.component';
import { CloudSetupComponent } from './cloud-setup/cloud-setup.component';
import { CloudSetupGuard } from './helpers/cloud-setup-guard.service';
import { ObservabilityComponent } from './observability/observability.component';
import { FullstackObservabilityComponent } from './fullstack-observability/fullstack-observability.component';
import { AcpPortalHealthComponent } from './acp-portal-health/acp-portal-health.component';
import { AboutComponent } from './about/about.component';
import { ContactComponent } from './contact/contact.component';
import { ForgotPasswordComponent } from './forgot-password/forgot-password.component';
import { AcpSecurityComponent } from './acp-security/acp-security.component';
import { InfraAppSecurityComponent } from './infra-app-security/infra-app-security.component';
import { AiopsObservabilityComponent } from './aiops-observability/aiops-observability.component';


const routes: Routes = [
  { path: '', component: LoginComponent },
  { path: 'login', component: LoginComponent },

  { path: 'services', component: MainPageComponent },
  { path: 'infraservices', component: InfrastructureServicesComponent, canActivate: [AuthGuardService, CloudSetupGuard] },
  { path: 'CreateApplication', component: CreateApplicationComponent, canActivate: [AuthGuardService] },
  { path: 'CreateInfrastructure', component: CreateInfrastructureComponent, canActivate: [AuthGuardService] },
  { path: 'infrastructure-resources', component: InfrastructureResourcesComponent, canActivate: [AuthGuardService] },
  { path: 'appservices', component: ApplicationServicesComponent, canActivate: [AuthGuardService] },
  { path: 'ApplicationResources', component: ApplicationResourcesComponent, canActivate: [AuthGuardService] },
  { path: 'tenant', component: TenantInfoComponent, canActivate: [AuthGuardService] },
  { path: 'wizard', component: WizardComponent, canActivate: [AuthGuardService] },
  { path: 'deployment-logs', component: DeploymentLogsComponent, canActivate: [AuthGuardService] },
  { path: 'automation-deployment', component: AutomationDeploymentComponent, canActivate: [AuthGuardService] },
  { path: 'security-compliance', component: SecurityComplianceComponent, canActivate: [AuthGuardService] },
  { path: 'deploy-existing', component: DeployExistingComponent, canActivate: [AuthGuardService] },
  { path: 'automation-logs', component: AutomationLogsComponent, canActivate: [AuthGuardService] },
  { path: 'view-deployments', component: ViewDeploymentsComponent, canActivate: [AuthGuardService] },
  { path: 'running-deployments', component: ViewDeploymentsComponent, canActivate: [AuthGuardService] },
  { path: 'newuser', component: NewuserComponent },
  { path: 'confirm', component: ConfirmComponent },
  { path: 'cloud-setup', component: CloudSetupComponent, canActivate: [AuthGuardService] },
  { path: 'fullstack-observability', component: FullstackObservabilityComponent, canActivate: [AuthGuardService] },
  { path: 'observability/acp-portal-health', component: AcpPortalHealthComponent, canActivate: [AuthGuardService] },
  { path: 'observability', component: ObservabilityComponent, canActivate: [AuthGuardService] },
  { path: 'about', component: AboutComponent },
  { path: 'contact', component: ContactComponent },
  { path: 'forgotpassword', component: ForgotPasswordComponent },
  { path: 'security/acp-security', component: AcpSecurityComponent, canActivate: [AuthGuardService] },
  { path: 'security-compliance/infra-app', component: InfraAppSecurityComponent, canActivate: [AuthGuardService] },
  { path: 'aiops', component: AiopsObservabilityComponent, canActivate: [AuthGuardService] },
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
