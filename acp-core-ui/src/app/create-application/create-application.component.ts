import { Component, OnInit, ViewChild } from '@angular/core';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { AuthServiceService } from '../services/auth-service.service';
import { EnvService } from 'src/environments/env.service';
import { IUser } from '../models/user.model';
import { Subscription } from 'rxjs';
import { AppGenerateComponent } from '../app-generate/app-generate.component';

@Component({
  selector: 'app-create-application',
  templateUrl: './create-application.component.html',
  styleUrls: ['./create-application.component.css']
})
export class CreateApplicationComponent implements OnInit {

  @ViewChild('generateScreen') generateScreen!: AppGenerateComponent;

  authSub: Subscription | undefined;
  curUser: IUser | undefined;

  // ── Wizard State
  currentStep = 1;
  hasErrors = false;
  errorMessages: string[] = [];

  // ── Generation screen toggle
  showGenerateScreen = false;

  // ── Step 1: App Identity
  appName = '';
  appType = '';
  appDescription = '';
  frontendFramework = '';
  backendFramework = '';

  // ── Step 2: AI Generation / App Detail
  frontendDescription = '';
  backendDescription = '';
  apiEndpoints = '';
  database = 'none';
  authType = 'none';
  dataModels = '';
  apiIntegrations = [
    { label: 'REST API', selected: false },
    { label: 'GraphQL', selected: false },
    { label: 'AWS S3', selected: false },
    { label: 'AWS SQS', selected: false },
    { label: 'Stripe', selected: false },
    { label: 'SendGrid', selected: false },
    { label: 'Twilio', selected: false },
    { label: 'OAuth2', selected: false },
  ];

  // ── Step 3: Deployment Target
  cloudProvider = '';
  deploymentType = '';
  deploymentOptions: string[] = [];
  environment = '';
  containerPort: number | null = 8080;

  // ── Step 4: GitHub & CI/CD
  repoName = '';
  githubOrg = '';
  branch = 'main';
  isPrivate = false;
  githubPAT = '';

  // ── Generation State (kept for backwards compat, not shown in form anymore)
  isGenerating = false;

  constructor(
    private router: Router,
    private http: HttpClient,
    private authService: AuthServiceService,
    private envService: EnvService
  ) { }

  ngOnInit(): void {
    this.curUser = this.authService.currentUserValue;
  }

  // ── Step Navigation
  goToStep(step: number): void {
    if (step < this.currentStep) {
      this.currentStep = step;
      this.hasErrors = false;
      this.errorMessages = [];
    }
  }

  nextStep(): void {
    this.errorMessages = [];
    if (!this.validateCurrentStep()) {
      this.hasErrors = true;
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    this.hasErrors = false;
    this.currentStep++;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  prevStep(): void {
    this.hasErrors = false;
    this.errorMessages = [];
    this.currentStep--;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  cancel(): void {
    this.router.navigateByUrl('/appservices');
  }

  // ── Cloud Provider Selection
  selectCloud(cloud: string): void {
    this.cloudProvider = cloud;
    this.deploymentType = '';
    if (cloud === 'AWS') {
      this.deploymentOptions = ['AWS ECS Fargate', 'AWS EKS', 'AWS EC2'];
    } else if (cloud === 'Azure') {
      this.deploymentOptions = ['Azure AKS', 'Azure Container Apps', 'Azure VM'];
    } else if (cloud === 'GCP') {
      this.deploymentOptions = ['GCP GKE', 'GCP Cloud Run', 'GCP Compute Engine'];
    }
  }

  onAppTypeChange(): void {
    if (this.appType === 'MicroService') {
      this.frontendFramework = '';
      this.frontendDescription = '';
    }
  }

  syncRepoName(): void {
    if (!this.repoName || this.repoName === this.slugify(this.appName.slice(0, -1))) {
      this.repoName = this.slugify(this.appName);
    }
  }

  private slugify(val: string): string {
    return val.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9\-]/g, '');
  }

  // ── Validation
  private validateCurrentStep(): boolean {
    this.errorMessages = [];
    switch (this.currentStep) {
      case 1:
        if (!this.appName || this.appName.trim().length === 0) {
          this.errorMessages.push('App Name is required.');
        } else if (!/^[a-z0-9\-]+$/.test(this.appName)) {
          this.errorMessages.push('App Name must be lowercase, numbers, and hyphens only.');
        }
        if (!this.appType) this.errorMessages.push('App Type is required.');
        if (!this.appDescription || this.appDescription.trim().length === 0) {
          this.errorMessages.push('App Description is required.');
        }
        break;
      case 2:
        if (this.appType === 'Full-Stack' && !this.frontendFramework) {
          this.errorMessages.push('Frontend Framework is required for Full-Stack apps.');
        }
        if (!this.backendFramework) {
          this.errorMessages.push('Backend Framework is required.');
        }
        if (!this.backendDescription || this.backendDescription.trim().length < 10) {
          this.errorMessages.push('Backend description is required (at least 10 characters).');
        }
        break;
      case 3:
        if (!this.cloudProvider) this.errorMessages.push('Cloud Provider is required.');
        if (!this.deploymentType) this.errorMessages.push('Deployment Type is required.');
        if (!this.environment) this.errorMessages.push('Environment is required.');
        if (!this.containerPort) this.errorMessages.push('Container Port is required.');
        break;
      case 4:
        if (!this.repoName || this.repoName.trim().length === 0) {
          this.errorMessages.push('GitHub Repository Name is required.');
        }
        if (!this.githubOrg || this.githubOrg.trim().length === 0) {
          this.errorMessages.push('GitHub Organization is required.');
        }
        if (!this.githubPAT || this.githubPAT.trim().length === 0) {
          this.errorMessages.push('GitHub Personal Access Token is required to create and push to a repository.');
        }
        break;
      case 5:
        break;
    }
    return this.errorMessages.length === 0;
  }

  // ── Generate & Deploy
  async generate(): Promise<void> {
    this.errorMessages = [];
    if (!this.validateCurrentStep()) {
      this.hasErrors = true;
      return;
    }
    this.hasErrors = false;

    // Switch to the progress screen immediately
    this.showGenerateScreen = true;
    window.scrollTo({ top: 0, behavior: 'smooth' });

    try {
      const apiBase = this.envService.apiUrl;
      const result: any = await this.http
        .post(`${apiBase}applications/generate`, this.buildPayload())
        .toPromise();

      // Tell the progress screen we're done
      setTimeout(() => {
        this.generateScreen?.onComplete({
          repoUrl: result.repoUrl,
          filesCommitted: result.filesCommitted,
          summary: result.summary,
          error: result.error || null,
        });
      }, 0);

    } catch (err: any) {
      const message = err?.error?.error || err?.message || 'Generation failed. Please try again.';
      setTimeout(() => {
        this.generateScreen?.onComplete({
          repoUrl: null,
          filesCommitted: 0,
          summary: '',
          error: message,
        });
      }, 0);
    }
  }

  private buildPayload(): any {
    return {
      appName: this.appName,
      appType: this.appType,
      appDescription: this.appDescription,
      frontendDescription: this.frontendDescription,
      backendDescription: this.backendDescription,
      apiEndpoints: this.apiEndpoints,
      database: this.database,
      authType: this.authType,
      dataModels: this.dataModels,
      integrations: this.apiIntegrations.filter(a => a.selected).map(a => a.label),
      frontendFramework: this.frontendFramework,
      backendFramework: this.backendFramework,
      cloudProvider: this.cloudProvider,
      deploymentType: this.deploymentType,
      environment: this.environment,
      containerPort: this.containerPort,
      repoName: this.repoName,
      githubOrg: this.githubOrg,
      branch: this.branch,
      isPrivate: this.isPrivate,
      githubPAT: this.githubPAT,
    };
  }
}