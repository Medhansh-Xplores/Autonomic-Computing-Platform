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
  { path: 'deployment-logs', component: DeploymentLogsComponent }
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }