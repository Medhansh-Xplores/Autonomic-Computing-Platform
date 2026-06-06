import { Component, OnInit, OnDestroy, Input } from '@angular/core';
import { Router } from '@angular/router';

export interface GenerateResult {
  repoUrl: string | null;
  filesCommitted: number;
  summary: string;
  error?: string | null;
}

@Component({
  selector: 'app-generate',
  templateUrl: './app-generate.component.html',
  styleUrls: ['./app-generate.component.css']
})
export class AppGenerateComponent implements OnInit, OnDestroy {

  @Input() appName = '';
  @Input() repoName = '';
  @Input() githubOrg = '';

  // ── Phase steps ─────────────────────────────────────────────────────────────
  phaseSteps = [
    { label: 'Analyzing your requirements…', icon: '🧠', done: false, active: false },
    { label: 'Scaffolding project structure…', icon: '📐', done: false, active: false },
    { label: 'Generating application code with AI…', icon: '✨', done: false, active: false },
    { label: 'Creating Dockerfile & config…', icon: '🐳', done: false, active: false },
    { label: 'Pushing files to GitHub…', icon: '🔗', done: false, active: false },
    { label: 'Finalizing…', icon: '🎉', done: false, active: false },
  ];

  currentPhaseIndex = 0;
  private phaseInterval: any;

  // ── State ────────────────────────────────────────────────────────────────────
  isGenerating = true;
  result: GenerateResult | null = null;
  hasError = false;

  constructor(private router: Router) { }

  ngOnInit(): void {
    this.startPhaseAnimation();
  }

  ngOnDestroy(): void {
    this.stopPhaseAnimation();
  }

  // ── Called by parent when generation completes (success or error) ────────────
  onComplete(result: GenerateResult): void {
    this.stopPhaseAnimation();
    this.phaseSteps.forEach(s => { s.done = true; s.active = false; });
    this.isGenerating = false;
    this.result = result;
    this.hasError = !!result.error || !result.repoUrl;
  }

  // ── Phase animation ──────────────────────────────────────────────────────────
  private startPhaseAnimation(): void {
    this.phaseSteps[0].active = true;
    this.phaseInterval = setInterval(() => {
      this.phaseSteps[this.currentPhaseIndex].done = true;
      this.phaseSteps[this.currentPhaseIndex].active = false;
      this.currentPhaseIndex = Math.min(this.currentPhaseIndex + 1, this.phaseSteps.length - 1);
      this.phaseSteps[this.currentPhaseIndex].active = true;
    }, 5000);
  }

  private stopPhaseAnimation(): void {
    if (this.phaseInterval) clearInterval(this.phaseInterval);
  }

  // ── Navigation ───────────────────────────────────────────────────────────────
  goToAppServices(): void {
    this.router.navigateByUrl('/appservices');
  }

  openRepo(): void {
    if (this.result?.repoUrl) window.open(this.result.repoUrl, '_blank');
  }
  goToDeployment(): void {
    this.router.navigateByUrl('/automation-deployment');
  }
}
