
import { BrowserModule } from '@angular/platform-browser';
import { APP_INITIALIZER, NgModule, SimpleChange } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { HttpClientModule } from '@angular/common/http';
import { CommonModule, HashLocationStrategy, LocationStrategy } from '@angular/common';
import { FontAwesomeModule, FaIconLibrary } from '@fortawesome/angular-fontawesome';
import { faCoffee, fas } from '@fortawesome/free-solid-svg-icons';
import { MatTabsModule } from '@angular/material/tabs'


// current components
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
    { provide: APP_INITIALIZER, useFactory: (envService: EnvService) => () => envService.init(), deps: [EnvService], multi: true }
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
