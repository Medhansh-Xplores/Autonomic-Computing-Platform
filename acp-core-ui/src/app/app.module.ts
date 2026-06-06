import { BrowserModule } from '@angular/platform-browser';
import { APP_INITIALIZER, NgModule, SimpleChange } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { HttpClientModule } from '@angular/common/http';
import { CommonModule, HashLocationStrategy, LocationStrategy } from '@angular/common';
import { FontAwesomeModule, FaIconLibrary } from '@fortawesome/angular-fontawesome';
import { faCoffee, fas } from '@fortawesome/free-solid-svg-icons';
import { MatTabsModule } from '@angular/material/tabs'
import { HTTP_INTERCEPTORS } from '@angular/common/http';
import { AuthInterceptorService } from './helpers/auth-interceptor.service';
import { SecurityComplianceComponent } from './security-compliance/security-compliance.component';

import { AppComponent } from './app.component';
import { HeaderComponent } from './header/header.component';
import { FooterComponent } from './footer/footer.component';
import { ApplicationServicesComponent } from './application-services/application-services.component';
import { CreateApplicationComponent } from './create-application/create-application.component';
import { LoginComponent } from './login/login.component';
import { CreateInfrastructureComponent } from './create-infrastructure/create-infrastructure.component';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { MatDialogModule } from '@angular/material/dialog';
import { InfrastructureServicesComponent } from './infrastructure-services/infrastructure-services.component';
import { InfrastructureResourcesComponent } from './infrastructure-resources/infrastructure-resources.component';
import { ApplicationResourcesComponent } from './application-resources/application-resources.component';
import { AppRoutingModule } from './app-routing.module';
import { MainPageComponent } from './main-page/main-page.component';
import { TenantInfoComponent } from './tenant/tenant-info.component';
import { WizardComponent } from './wizard/wizard.component';
import { DeploymentLogsComponent } from './deployment-logs.component/deployment-logs.component';
import { EnvService } from 'src/environments/env.service';
import { AutomationDeploymentComponent } from './automation-deployment/automation-deployment.component';
import { DeployExistingComponent } from './automation-deployment/deploy-existing/deploy-existing.component';
import { AutomationLogsComponent } from './automation-logs/automation-logs.component';
import { ViewDeploymentsComponent } from './automation-deployment/view-deployments/view-deployments.component';
import { NewuserComponent } from './newuser/newuser.component';
import { ConfirmComponent } from './confirm/confirm.component';
import { CloudSetupComponent } from './cloud-setup/cloud-setup.component';
import { ObservabilityComponent } from './observability/observability.component';
import { FullstackObservabilityComponent } from './fullstack-observability/fullstack-observability.component';
import { AcpPortalHealthComponent } from './acp-portal-health/acp-portal-health.component';
import { AboutComponent } from './about/about.component';
import { ContactComponent } from './contact/contact.component';
import { ForgotPasswordComponent } from './forgot-password/forgot-password.component';
import { AcpSecurityComponent } from './acp-security/acp-security.component';
import { InfraAppSecurityComponent } from './infra-app-security/infra-app-security.component';
import { AiopsObservabilityComponent } from './aiops-observability/aiops-observability.component';
import { AppGenerateComponent } from './app-generate/app-generate.component';
import { ViewApplicationsComponent } from './view-applications/view-applications.component';

@NgModule({
  declarations: [
    AppComponent,
    HeaderComponent,
    FooterComponent,
    MainPageComponent,
    CreateApplicationComponent,
    LoginComponent,
    CreateInfrastructureComponent,
    InfrastructureResourcesComponent,
    InfrastructureServicesComponent,
    ApplicationResourcesComponent,
    ApplicationServicesComponent,
    TenantInfoComponent,
    WizardComponent,
    DeploymentLogsComponent,
    AutomationDeploymentComponent,
    DeployExistingComponent,
    AutomationLogsComponent,
    ViewDeploymentsComponent,
    NewuserComponent,
    ConfirmComponent,
    SecurityComplianceComponent,
    CloudSetupComponent,
    ObservabilityComponent,
    FullstackObservabilityComponent,
    AcpPortalHealthComponent,
    AboutComponent,
    ContactComponent,
    ForgotPasswordComponent,
    AcpSecurityComponent,
    InfraAppSecurityComponent,
    AiopsObservabilityComponent,
    AppGenerateComponent,
    ViewApplicationsComponent,
  ],
  imports: [
    BrowserModule,
    AppRoutingModule,
    FormsModule,
    ReactiveFormsModule,
    CommonModule,
    HttpClientModule,
    MatDialogModule,
    BrowserAnimationsModule,
    FontAwesomeModule,
    MatTabsModule,
  ],
  providers: [
    { provide: LocationStrategy, useClass: HashLocationStrategy },
    { provide: APP_INITIALIZER, useFactory: (envService: EnvService) => () => envService.init(), deps: [EnvService], multi: true },
    { provide: HTTP_INTERCEPTORS, useClass: AuthInterceptorService, multi: true },
  ],
  entryComponents: [],
  bootstrap: [AppComponent]
})
export class AppModule {
  constructor(library: FaIconLibrary) {
    library.addIconPacks(fas);
    library.addIcons(faCoffee);
  }
}
