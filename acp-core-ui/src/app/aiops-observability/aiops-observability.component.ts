import { Component, OnInit, OnDestroy } from '@angular/core';
import { AiopsService } from '../services/aiops.service';
import { CloudAccountService, CloudAccount } from '../services/cloud-account.service';

export type ScanMode = 'observe' | 'full';
export type SectionTab = 'findings' | 'approvals' | 'incidents' | 'audit';

@Component({
    selector: 'app-aiops-observability',
    templateUrl: './aiops-observability.component.html',
    styleUrls: ['./aiops-observability.component.css']
})
export class AiopsObservabilityComponent implements OnInit, OnDestroy {

    // ── Controls ──────────────────────────────────────────────────────────────
    selectedMode: ScanMode = 'observe';
    activeSection: SectionTab = 'findings';

    // ── Cloud account (same pattern as ObservabilityComponent) ────────────────
    cloudAccounts: CloudAccount[] = [];
    selectedAccount: CloudAccount | null = null;
    accountsLoading = true;
    accountsError = '';

    // ── Scan state ────────────────────────────────────────────────────────────
    scanning = false;
    scanError = '';
    scanResult: any = null;
    lastRunAt: Date | null = null;
    scanPhase = 'Starting agents…';
    currentSessionId = '';

    // ── Parsed results ────────────────────────────────────────────────────────
    infraFindings: any[] = [];
    appFindings: any[] = [];
    actionsTaken: any[] = [];
    pendingApprovals: any[] = [];

    // ── Incidents & Audit ─────────────────────────────────────────────────────
    incidents: any[] = [];
    auditLog: any[] = [];
    incidentsLoading = false;
    auditLoading = false;

    private phaseMessages = [
        'Starting agents…',
        'Infra Monitor Agent scanning ECS, RDS, ALB…',
        'App Health Agent scanning deployments…',
        'Agents analyzing findings…',
        'Remediation Agent deciding actions…',
        'Finalizing report…',
    ];
    private phaseInterval: any;

    constructor(
        private aiopsService: AiopsService,
        private cloudAccountService: CloudAccountService
    ) { }

    ngOnInit(): void {
        this.loadCloudAccounts();
    }

    ngOnDestroy(): void {
        this.stopPhaseAnimation();
    }

    // ── Load cloud accounts first, then auto-run ──────────────────────────────
    loadCloudAccounts(): void {
        this.accountsLoading = true;
        this.cloudAccountService.getAccounts().subscribe({
            next: (accounts) => {
                this.cloudAccounts = accounts || [];
                this.selectedAccount = this.cloudAccounts.find(a => a.isDefault)
                    || this.cloudAccounts[0]
                    || null;
                this.accountsLoading = false;

                if (this.selectedAccount) {
                    // Auto-run scan once we have an account
                    this.runScan();
                } else {
                    this.accountsError = 'No cloud account configured. Please set up a cloud account first.';
                }
            },
            error: () => {
                this.accountsLoading = false;
                this.accountsError = 'Failed to load cloud accounts.';
            }
        });
    }

    onAccountChange(accountId: string): void {
        this.selectedAccount = this.cloudAccounts.find(a => a.accountId === accountId) || null;
        // Re-run scan with new account
        if (this.selectedAccount) this.runScan();
    }

    // ── Mode toggle ───────────────────────────────────────────────────────────
    setMode(mode: ScanMode): void {
        this.selectedMode = mode;
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
        this.activeSection = 'findings';

        this.startPhaseAnimation();

        this.aiopsService.runScan(
            this.selectedMode,
            this.selectedAccount.accountId,
            this.selectedAccount.region
        ).subscribe({
            next: (result) => {
                this.scanning = false;
                this.scanResult = result;
                this.lastRunAt = new Date();
                this.currentSessionId = result.sessionId || '';
                this.stopPhaseAnimation();
                this.parseResult(result);
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
            this.pendingApprovals = (rem?.pendingApproval || []).map((a: any) => ({ ...a, processing: false }));
        } catch { this.actionsTaken = []; this.pendingApprovals = []; }

        if (this.pendingApprovals.length > 0) this.activeSection = 'approvals';
    }

    // ── Approve / Reject ──────────────────────────────────────────────────────
    approveAction(approval: any): void {
        approval.processing = true;
        this.aiopsService.approveAction(this.currentSessionId, true, approval.action, approval.target).subscribe({
            next: () => {
                this.pendingApprovals = this.pendingApprovals.filter(a => a !== approval);
                this.actionsTaken.push({ ...approval, result: 'success', message: 'Approved and executed' });
            },
            error: () => { approval.processing = false; }
        });
    }

    rejectAction(approval: any): void {
        approval.processing = true;
        this.aiopsService.approveAction(this.currentSessionId, false, approval.action, approval.target).subscribe({
            next: () => { this.pendingApprovals = this.pendingApprovals.filter(a => a !== approval); },
            error: () => { approval.processing = false; }
        });
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

    // ── Audit log ─────────────────────────────────────────────────────────────
    loadAuditLog(): void {
        if (this.auditLoading || this.auditLog.length > 0) return;
        this.auditLoading = true;
        this.aiopsService.getAuditLog().subscribe({
            next: (data) => { this.auditLog = data; this.auditLoading = false; },
            error: () => { this.auditLoading = false; }
        });
    }

    // ── Phase animation ───────────────────────────────────────────────────────
    private startPhaseAnimation(): void {
        let i = 0;
        this.scanPhase = this.phaseMessages[0];
        this.phaseInterval = setInterval(() => {
            i = (i + 1) % this.phaseMessages.length;
            this.scanPhase = this.phaseMessages[i];
        }, 4000);
    }

    private stopPhaseAnimation(): void {
        if (this.phaseInterval) clearInterval(this.phaseInterval);
    }

    // ── Computed ──────────────────────────────────────────────────────────────
    get totalFindings(): number {
        return this.infraFindings.length + this.appFindings.length;
    }
}
