import { Component, OnInit, OnDestroy } from '@angular/core';
import { AiopsService } from '../services/aiops.service';
import { CloudAccountService, CloudAccount } from '../services/cloud-account.service';

export type SectionTab = 'findings' | 'approvals' | 'resolution' | 'runs';

@Component({
    selector: 'app-aiops-observability',
    templateUrl: './aiops-observability.component.html',
    styleUrls: ['./aiops-observability.component.css']
})
export class AiopsObservabilityComponent implements OnInit, OnDestroy {

    // ── Controls ──────────────────────────────────────────────────────────────
    selectedMode: 'observe' | 'full' | 'remediate-only' = 'full';
    activeSection: SectionTab = 'findings';

    // ── Cloud account ─────────────────────────────────────────────────────────
    cloudAccounts: CloudAccount[] = [];
    selectedAccount: CloudAccount | null = null;
    accountsLoading = true;
    accountsError = '';

    // ── Scan state ────────────────────────────────────────────────────────────
    scanning = false;
    scanError = ''
    scanResult: any = null;
    lastRunAt: Date | null = null;
    scanDurationMs: number | null = null;
    scanPhase = 'Starting agents…';
    currentSessionId = '';
    currentScanMeta: any = {};

    // ── Parsed results ────────────────────────────────────────────────────────
    infraFindings: any[] = [];
    appFindings: any[] = [];
    actionsTaken: any[] = [];
    pendingApprovals: any[] = [];

    // ── Scan metadata (from backend scanMeta) ─────────────────────────────────
    scanMeta: any = null;
    scanRuns: any[] = [];
    runsLoading = false;

    // ── Phase steps (shown with checkmarks as scan progresses) ───────────────
    phaseSteps = [
        { label: 'Starting agents…', done: false },
        { label: 'Infra Monitor scanning ECS, RDS, ALB…', done: false },
        { label: 'App Health scanning deployments…', done: false },
        { label: 'Agents analyzing findings…', done: false },
        { label: 'Remediation Agent deciding actions…', done: false },
        { label: 'Finalizing report…', done: false },
    ];
    currentPhaseIndex = 0;
    private phaseInterval: any;

    // ── Remediation Log ───────────────────────────────────────────────────────────
    resolutionSubTab: 'actions' | 'incidents' = 'actions';
    incidents: any[] = [];
    incidentsLoading = false;


    constructor(
        private aiopsService: AiopsService,
        private cloudAccountService: CloudAccountService
    ) { }

    ngOnInit(): void {
        this.loadCloudAccounts();
        this.restoreFromCache();
    }

    ngOnDestroy(): void {
        this.stopPhaseAnimation();
    }

    // ── Load cloud accounts ───────────────────────────────────────────────────
    loadCloudAccounts(): void {
        this.accountsLoading = true;
        this.cloudAccountService.getAccounts().subscribe({
            next: (accounts) => {
                this.cloudAccounts = accounts || [];
                this.selectedAccount = this.cloudAccounts.find(a => a.isDefault)
                    || this.cloudAccounts[0]
                    || null;
                this.accountsLoading = false;

                if (!this.selectedAccount) {
                    this.accountsError = 'No cloud account configured. Please set up a cloud account first.';
                }
            },
            error: () => {
                this.accountsLoading = false;
                this.accountsError = 'Failed to load cloud accounts.';
            }
        });
    }

    // ── Restore last scan from service cache ──────────────────────────────
    private restoreFromCache(): void {
        if (!this.aiopsService.lastScanResult) return;
        this.scanResult = this.aiopsService.lastScanResult;
        this.scanMeta = this.aiopsService.lastScanMeta;
        this.infraFindings = this.aiopsService.lastInfraFindings;
        this.appFindings = this.aiopsService.lastAppFindings;
        this.actionsTaken = this.aiopsService.lastActionsTaken;
        this.pendingApprovals = this.aiopsService.lastPendingApprovals;
        this.lastRunAt = this.aiopsService.lastRunAt;
        this.scanDurationMs = this.aiopsService.lastScanDurationMs;
        this.currentSessionId = this.aiopsService.lastSessionId;
        this.currentScanMeta = this.aiopsService.lastScanMetaRaw;
        this.phaseSteps.forEach(s => s.done = true);
        this.activeSection = this.aiopsService.lastActiveSection;
    }

    onAccountChange(accountId: string): void {
        this.selectedAccount = this.cloudAccounts.find(a => a.accountId === accountId) || null;
    }

    // ── Set active tab and persist to cache ───────────────────────────────
    setSection(tab: SectionTab): void {
        this.activeSection = tab;
        if (this.aiopsService.lastScanResult) this.aiopsService.lastActiveSection = tab;
    }

    // ── Save scan to service cache ─────────────────────────────────────────
    private saveToCache(): void {
        this.aiopsService.lastScanResult = this.scanResult;
        this.aiopsService.lastScanMeta = this.scanMeta;
        this.aiopsService.lastInfraFindings = this.infraFindings;
        this.aiopsService.lastAppFindings = this.appFindings;
        this.aiopsService.lastActionsTaken = this.actionsTaken;
        this.aiopsService.lastPendingApprovals = this.pendingApprovals;
        this.aiopsService.lastRunAt = this.lastRunAt;
        this.aiopsService.lastScanDurationMs = this.scanDurationMs;
        this.aiopsService.lastSessionId = this.currentSessionId;
        this.aiopsService.lastScanMetaRaw = this.currentScanMeta;
        this.aiopsService.lastActiveSection = this.activeSection;
    }

    // ── Run scan ──────────────────────────────────────────────────────────────
    runScan(): void {
        if (this.scanning || !this.selectedAccount) return;

        this.scanning = true;
        this.scanError = '';
        this.scanResult = null;
        this.infraFindings = [];
        this.appFindings = [];
        this.actionsTaken = [];
        this.pendingApprovals = [];
        this.scanMeta = null;
        this.scanDurationMs = null;
        this.activeSection = 'findings';
        this.resetPhaseSteps();

        const scanStart = Date.now();
        this.startPhaseAnimation();

        this.aiopsService.runScan(
            this.selectedMode,
            this.selectedAccount.accountId,
            this.selectedAccount.region
        ).subscribe({
            next: (result) => {
                this.scanning = false;
                this.scanResult = result;
                this.scanRuns = [];
                this.lastRunAt = new Date();
                this.scanDurationMs = Date.now() - scanStart;
                this.currentSessionId = result.sessionId || '';
                this.currentScanMeta = result.scanMeta || {};
                this.stopPhaseAnimation();
                this.parseResult(result);
                this.saveToCache();
            },
            error: (err) => {
                this.scanning = false;
                this.scanError = err?.error?.error || 'Scan failed. Check backend logs.';
                this.stopPhaseAnimation();
            }
        });
    }

    // ── Parse backend response ────────────────────────────────────────────────
    private parseResult(result: any): void {
        try { this.infraFindings = result.infraFindings?.findings || []; } catch { this.infraFindings = []; }
        try { this.appFindings = result.appFindings?.findings || []; } catch { this.appFindings = []; }
        try {
            const rem = result.remediation;
            this.actionsTaken = rem?.actionsAttempted || [];
            this.pendingApprovals = (rem?.pendingApproval || []).map((a: any) => ({
                ...a,
                processing: false,
                riskLevel: a.riskLevel ?? this.inferRiskLevel(a.action),
            }));
        } catch { this.actionsTaken = []; this.pendingApprovals = []; }

        // Merge scanMeta from backend (runner.js) with local timing
        this.scanMeta = {
            ...(result.scanMeta || {}),
            durationMs: this.scanDurationMs,
            sessionId: this.currentSessionId,
            mode: this.selectedMode,
        };

        if (this.pendingApprovals.length > 0) this.activeSection = 'approvals';
    }

    // ── Approve / Reject ──────────────────────────────────────────────────────
    approveAction(approval: any): void {
        approval.processing = true;
        this.aiopsService.approveAction(
            this.currentSessionId,
            true,
            approval.action,
            approval.target,
            this.currentScanMeta?.accountId,
            this.currentScanMeta?.region,
            approval.desiredCount ?? 1,
            approval.reason,
        ).subscribe({
            next: () => {
                this.pendingApprovals = this.pendingApprovals.filter(a => a !== approval);
                this.actionsTaken.push({ ...approval, result: 'success', message: 'Approved and executed' });
                this.saveToCache();
            },
            error: () => { approval.processing = false; }
        });
    }

    rejectAction(approval: any): void {
        approval.processing = true;
        this.aiopsService.approveAction(
            this.currentSessionId,
            false,
            approval.action,
            approval.target,
            this.currentScanMeta?.accountId,
            this.currentScanMeta?.region,
        ).subscribe({
            next: () => {
                this.pendingApprovals = this.pendingApprovals.filter(a => a !== approval);
                this.saveToCache();
            },
            error: () => { approval.processing = false; }
        });
    }

    // ── Risk level inference ──────────────────────────────────────────────────────
    inferRiskLevel(action: string): 'high' | 'medium' | 'low' {
        if (!action) return 'low';
        const a = action.toLowerCase();
        if (a.includes('delete') || a.includes('terminate') || a.includes('alb') || a.includes('rds')) return 'high';
        if (a.includes('scale') || a.includes('restart') || a.includes('ecs')) return 'medium';
        return 'low';
    }

    // ── Resolution time formatter ─────────────────────────────────────────────────
    resolutionTimeLabel(ms: number | null | undefined): string {
        if (ms == null) return '—';
        if (ms < 1000) return `${ms}ms`;
        const s = Math.round(ms / 1000);
        return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`;
    }

    // ── Incidents ─────────────────────────────────────────────────────────────
    loadIncidents(): void {
        if (this.incidentsLoading || this.incidents.length > 0) return;
        this.incidentsLoading = true;
        this.aiopsService.getIncidents().subscribe({
            next: (data) => { this.incidents = data; this.incidentsLoading = false; },
            error: () => { this.incidentsLoading = false; }
        });
    }

    updateIncident(inc: any): void {
        this.aiopsService.updateIncident(inc.id, inc.status).subscribe();
    }

    loadScanRuns(): void {
        if (this.runsLoading || this.scanRuns.length > 0) return;
        this.runsLoading = true;
        this.aiopsService.getScanRuns().subscribe({
            next: (data) => { this.scanRuns = data; this.runsLoading = false; },
            error: () => { this.runsLoading = false; }
        });
    }

    // ── Phase animation with step checkmarks ──────────────────────────────────
    private resetPhaseSteps(): void {
        this.currentPhaseIndex = 0;
        this.phaseSteps.forEach(s => s.done = false);
        this.scanPhase = this.phaseSteps[0].label;
    }

    private startPhaseAnimation(): void {
        this.phaseInterval = setInterval(() => {
            // Mark current step done, advance
            this.phaseSteps[this.currentPhaseIndex].done = true;
            this.currentPhaseIndex = (this.currentPhaseIndex + 1) % this.phaseSteps.length;
            this.scanPhase = this.phaseSteps[this.currentPhaseIndex].label;
        }, 4000);
    }

    private stopPhaseAnimation(): void {
        if (this.phaseInterval) clearInterval(this.phaseInterval);
        // Mark all steps done when scan completes
        this.phaseSteps.forEach(s => s.done = true);
    }

    // ── Computed helpers ──────────────────────────────────────────────────────
    get totalFindings(): number {
        return this.infraFindings.length + this.appFindings.length;
    }

    get scanDurationLabel(): string {
        if (this.scanDurationMs === null) return '';
        const s = Math.round(this.scanDurationMs / 1000);
        return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`;
    }

    get totalResourcesChecked(): number {
        const infra = this.scanMeta?.infraAgent?.resourcesChecked || 0;
        const app = this.scanMeta?.appAgent?.resourcesChecked || 0;
        return infra + app;
    }

    get orchestratorSummary(): string {
        return this.scanResult?.report?.summary
            || this.scanMeta?.infraSummary
            || this.scanMeta?.appSummary
            || '';
    }
}