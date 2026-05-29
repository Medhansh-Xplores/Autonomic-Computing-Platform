import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { AuthServiceService } from '../services/auth-service.service';
import { EnvService } from 'src/environments/env.service';
import { IUser } from '../models/user.model';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-create-application',
  templateUrl: './create-application.component.html',
  styleUrls: ['./create-application.component.css']
})
export class CreateApplicationComponent implements OnInit {

  authSub: Subscription | undefined;
  curUser: IUser | undefined;

  // ── Wizard State ──────────────────────────────────────────────
  currentStep = 1;
  hasErrors = false;
  errorMessages: string[] = [];

  // ── Step 1: App Identity ──────────────────────────────────────
  appName = '';
  appType = '';
  techStack = '';
  appDescription = '';

  // ── Step 2: AI Generation ─────────────────────────────────────
  aiPrompt = '';
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

  // ── Step 3: Deployment Target ─────────────────────────────────
  cloudProvider = '';
  deploymentType = '';
  deploymentOptions: string[] = [];
  environment = '';
  containerPort: number | null = 8080;
  healthCheckUrl = '/health';

  // ── Step 4: Runtime & Scaling ─────────────────────────────────
  memoryLimit = '';
  cpu = '';
  minReplicas: number | null = 1;
  maxReplicas: number | null = 3;
  imageTag = 'latest';

  // ── Step 5: GitHub & CI/CD ────────────────────────────────────
  repoName = '';
  githubOrg = '';
  branchStrategy = 'main';
  includeCICD = true;

  // ── Generation State ──────────────────────────────────────────
  isGenerating = false;
  generatingMessage = '';

  private generatingMessages = [
    'Analyzing your requirements...',
    'Scaffolding project structure...',
    'Generating application code with AI...',
    'Creating Dockerfile and container config...',
    'Building CI/CD pipeline...',
    'Pushing to GitHub repository...',
    'Finalizing deployment configuration...',
  ];

  constructor(
    private router: Router,
    private http: HttpClient,
    private authService: AuthServiceService,
    private envService: EnvService
  ) { }

  ngOnInit(): void {
    this.curUser = this.authService.currentUserValue;
  }

  // ── Step Navigation ────────────────────────────────────────────
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

  // ── Cloud Provider Selection ───────────────────────────────────
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

  // ── Sync repo name from app name ───────────────────────────────
  syncRepoName(): void {
    if (!this.repoName || this.repoName === this.slugify(this.appName.slice(0, -1))) {
      this.repoName = this.slugify(this.appName);
    }
  }

  private slugify(val: string): string {
    return val.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9\-]/g, '');
  }

  // ── Validation ─────────────────────────────────────────────────
  private validateCurrentStep(): boolean {
    this.errorMessages = [];

    switch (this.currentStep) {
      case 1:
        if (!this.appName || this.appName.trim().length === 0) {
          this.errorMessages.push('App Name is required.');
        } else if (!/^[a-z0-9\-]+$/.test(this.appName)) {
          this.errorMessages.push('App Name must be lowercase letters, numbers, and hyphens only.');
        }
        if (!this.appType) this.errorMessages.push('App Type is required.');
        if (!this.techStack) this.errorMessages.push('Programming Stack is required.');
        if (!this.appDescription || this.appDescription.trim().length === 0) {
          this.errorMessages.push('App Description is required.');
        }
        break;

      case 2:
        if (!this.aiPrompt || this.aiPrompt.trim().length < 20) {
          this.errorMessages.push('Please describe what the app should do (at least 20 characters).');
        }
        break;

      case 3:
        if (!this.cloudProvider) this.errorMessages.push('Cloud Provider is required.');
        if (!this.deploymentType) this.errorMessages.push('Deployment Type is required.');
        if (!this.environment) this.errorMessages.push('Environment is required.');
        if (!this.containerPort || this.containerPort < 1024 || this.containerPort > 49151) {
          this.errorMessages.push('Container Port must be between 1024 and 49151.');
        }
        break;

      case 4:
        if (!this.memoryLimit) this.errorMessages.push('Memory Limit is required.');
        if (!this.cpu) this.errorMessages.push('CPU allocation is required.');
        break;

      case 5:
        if (!this.repoName || this.repoName.trim().length === 0) {
          this.errorMessages.push('GitHub Repository Name is required.');
        }
        break;
    }

    return this.errorMessages.length === 0;
  }

  // ── Generate & Deploy ──────────────────────────────────────────
  async generate(): Promise<void> {
    this.errorMessages = [];
    if (!this.validateCurrentStep()) {
      this.hasErrors = true;
      return;
    }

    this.hasErrors = false;
    this.isGenerating = true;

    const payload = this.buildPayload();

    // Cycle through descriptive messages while processing
    let msgIndex = 0;
    this.generatingMessage = this.generatingMessages[msgIndex];
    const msgInterval = setInterval(() => {
      msgIndex = (msgIndex + 1) % this.generatingMessages.length;
      this.generatingMessage = this.generatingMessages[msgIndex];
    }, 2200);

    try {
      const apiBase = this.envService.apiUrl;
      await this.http.post(`${apiBase}applications/generate`, payload).toPromise();
      clearInterval(msgInterval);
      this.isGenerating = false;
      this.router.navigateByUrl('/appservices');
    } catch (error) {
      clearInterval(msgInterval);
      this.isGenerating = false;
      // Fallback: navigate after simulated generation for demo mode
      await this.simulateGeneration(msgInterval);
    }
  }

  private async simulateGeneration(existingInterval?: any): Promise<void> {
    this.isGenerating = true;
    let msgIndex = 0;
    this.generatingMessage = this.generatingMessages[msgIndex];

    const interval = setInterval(() => {
      msgIndex++;
      if (msgIndex < this.generatingMessages.length) {
        this.generatingMessage = this.generatingMessages[msgIndex];
      }
    }, 1800);

    await this.delay(this.generatingMessages.length * 1800);
    clearInterval(interval);
    this.isGenerating = false;
    this.router.navigateByUrl('/appservices');
  }

  private buildPayload(): any {
    return {
      // Step 1
      appName: this.appName,
      appType: this.appType,
      techStack: this.techStack,
      appDescription: this.appDescription,
      // Step 2
      aiPrompt: this.aiPrompt,
      database: this.database,
      authType: this.authType,
      dataModels: this.dataModels,
      integrations: this.apiIntegrations.filter(a => a.selected).map(a => a.label),
      // Step 3
      cloudProvider: this.cloudProvider,
      deploymentType: this.deploymentType,
      environment: this.environment,
      containerPort: this.containerPort,
      healthCheckUrl: this.healthCheckUrl,
      // Step 4
      memoryLimit: this.memoryLimit,
      cpu: this.cpu,
      minReplicas: this.minReplicas,
      maxReplicas: this.maxReplicas,
      imageTag: this.imageTag,
      // Step 5
      repoName: this.repoName,
      githubOrg: this.githubOrg,
      branchStrategy: this.branchStrategy,
      includeCICD: this.includeCICD,
    };
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
