import { Component, OnInit, OnDestroy } from '@angular/core';
import { Subscription } from 'rxjs';
import { ObservabilityService } from '../services/observability.service';
import { CloudAccountService, CloudAccount } from '../services/cloud-account.service';
import {
    VpcSecurityPayload, RdsSecurityPayload,
    AlbSecurityPayload, EcsSecurityPayload,
    SecurityCheck, SecurityOverall
} from '../models/security.model';
import { HttpClient } from '@angular/common/http';
import { EnvService } from 'src/environments/env.service';

@Component({
    selector: 'app-infra-app-security',
    templateUrl: './infra-app-security.component.html',
    styleUrls: ['./infra-app-security.component.css'],
})
export class InfraAppSecurityComponent implements OnInit, OnDestroy {

    // ── Tab state ─────────────────────────────────────────────────────────────
    activeTab: 'infra' | 'apps' = 'infra';

    // ── Cloud accounts ────────────────────────────────────────────────────────
    cloudAccounts: CloudAccount[] = [];
    selectedAccount: CloudAccount | null = null;

    // ── Infra tab — active card ───────────────────────────────────────────────
    activeInfraCard: 'vpc' | 'rds' | 'alb' | 'ecs' | null = null;

    // ── VPC security ──────────────────────────────────────────────────────────
    vpcSecurity: VpcSecurityPayload | null = null;
    vpcLoading = false;
    vpcError = '';
    private vpcSub: Subscription | null = null;
    // ── VPC detail panel state ────────────────────────────────────────────────
    selectedVpc: any = null;
    vpcDetail: any = null;
    vpcDetailLoading = false;
    vpcDetailError = '';

    // ── RDS security ──────────────────────────────────────────────────────────
    rdsSecurity: RdsSecurityPayload | null = null;
    rdsLoading = false;
    rdsError = '';
    private rdsSub: Subscription | null = null;

    // ── RDS detail panel state ────────────────────────────────────────────────
    selectedRds: any = null;
    rdsDetail: any = null;
    rdsDetailLoading = false;
    rdsDetailError = '';
    copiedEndpoint = false;

    // ── ALB security ──────────────────────────────────────────────────────────
    albSecurity: AlbSecurityPayload | null = null;
    albLoading = false;
    albError = '';
    private albSub: Subscription | null = null;
    // ── ALB detail panel state ────────────────────────────────────────────────
    selectedAlb: any = null;
    albDetail: any = null;
    albDetailLoading = false;
    albDetailError = '';
    copiedAlbDns = false;
    copiedArn = false;

    // ── ECS security ──────────────────────────────────────────────────────────
    ecsSecurity: EcsSecurityPayload | null = null;
    ecsLoading = false;
    ecsError = '';
    private ecsSub: Subscription | null = null;
    // ── ECS detail panel state ────────────────────────────────────────────────
    selectedEcsCluster: any = null;
    ecsDetail: any = null;
    ecsDetailLoading = false;
    ecsDetailError = '';

    // ── Apps tab state ────────────────────────────────────────────────────────
    allHealth: any[] = [];
    allHealthLoading = true;
    allHealthError = '';

    selectedDeployment: any = null;
    detailHealth: any = null;
    detailLoading = false;
    detailError = '';

    deployments: any[] = [];

    private allSub: Subscription | null = null;
    private detailSub: Subscription | null = null;

    apiBase = '';

    constructor(
        private observabilityService: ObservabilityService,
        private cloudAccountService: CloudAccountService,
        private http: HttpClient,
        private envService: EnvService
    ) { }

    ngOnInit(): void {
        this.apiBase = this.envService.apiUrl;
        this.loadCloudAccounts();
        this.loadDeployments();
    }

    ngOnDestroy(): void {
        this.allSub?.unsubscribe();
        this.detailSub?.unsubscribe();
        this.vpcSub?.unsubscribe();
        this.rdsSub?.unsubscribe();
        this.albSub?.unsubscribe();
        this.ecsSub?.unsubscribe();
    }

    // ── Tab switching ─────────────────────────────────────────────────────────

    switchTab(tab: 'infra' | 'apps'): void {
        this.activeTab = tab;
    }

    // ── Cloud accounts ────────────────────────────────────────────────────────

    loadCloudAccounts(): void {
        this.cloudAccountService.getAccounts().subscribe({
            next: (accounts) => {
                this.cloudAccounts = accounts || [];
                this.selectedAccount =
                    this.cloudAccounts.find(a => a.isDefault) ||
                    this.cloudAccounts[0] ||
                    null;
                if (this.selectedAccount) this.loadAll();
            },
            error: () => {
                this.cloudAccounts = [];
                this.selectedAccount = null;
            }
        });
    }

    onAccountChange(accountId: string): void {
        this.selectedAccount = this.cloudAccounts.find(a => a.accountId === accountId) || null;
        this.resetInfraData();
        if (this.activeInfraCard) {
            this.loadInfraCard(this.activeInfraCard);
        }
    }

    // ── Infra cards ───────────────────────────────────────────────────────────

    selectInfraCard(card: 'vpc' | 'rds' | 'alb' | 'ecs'): void {
        if (this.activeInfraCard === card) {
            this.activeInfraCard = null;
            return;
        }
        this.activeInfraCard = card;
        this.loadInfraCard(card);
    }

    private loadInfraCard(card: 'vpc' | 'rds' | 'alb' | 'ecs'): void {
        const region = this.selectedAccount?.region || 'us-east-1';
        const accountId = this.selectedAccount?.accountId || '';

        if (!accountId) {
            const msg = 'No cloud account selected';
            if (card === 'vpc') this.vpcError = msg;
            if (card === 'rds') this.rdsError = msg;
            if (card === 'alb') this.albError = msg;
            if (card === 'ecs') this.ecsError = msg;
            return;
        }

        if (card === 'vpc') {
            this.vpcSub?.unsubscribe();
            this.vpcLoading = true;
            this.vpcError = '';
            this.vpcSub = this.observabilityService.pollInfraVpcSecurity(accountId, region).subscribe({
                next: (data) => { this.vpcSecurity = data; this.vpcLoading = false; },
                error: (err) => { this.vpcError = err?.error?.error || 'Failed to load VPC security'; this.vpcLoading = false; }
            });
        }

        if (card === 'rds') {
            this.rdsSub?.unsubscribe();
            this.rdsLoading = true;
            this.rdsError = '';
            this.rdsSub = this.observabilityService.pollInfraRdsSecurity(accountId, region).subscribe({
                next: (data) => { this.rdsSecurity = data; this.rdsLoading = false; },
                error: (err) => { this.rdsError = err?.error?.error || 'Failed to load RDS security'; this.rdsLoading = false; }
            });
        }

        if (card === 'alb') {
            this.albSub?.unsubscribe();
            this.albLoading = true;
            this.albError = '';
            this.albSub = this.observabilityService.pollInfraAlbSecurity(accountId, region).subscribe({
                next: (data) => { this.albSecurity = data; this.albLoading = false; },
                error: (err) => { this.albError = err?.error?.error || 'Failed to load ALB security'; this.albLoading = false; }
            });
        }

        if (card === 'ecs') {
            this.ecsSub?.unsubscribe();
            this.ecsLoading = true;
            this.ecsError = '';
            this.ecsSub = this.observabilityService.pollInfraEcsSecurity(accountId, region).subscribe({
                next: (data) => { this.ecsSecurity = data; this.ecsLoading = false; },
                error: (err) => { this.ecsError = err?.error?.error || 'Failed to load ECS security'; this.ecsLoading = false; }
            });
        }
    }

    private loadAll(): void {
        const id = this.selectedAccount!.accountId;
        const region = this.selectedAccount!.region || 'us-east-1';

        this.vpcLoading = true; this.vpcError = '';
        this.vpcSub = this.observabilityService.pollInfraVpcSecurity(id, region).subscribe({
            next: d => { this.vpcSecurity = d; this.vpcLoading = false; },
            error: e => { this.vpcError = e?.error?.error || 'Failed'; this.vpcLoading = false; },
        });

        this.rdsLoading = true; this.rdsError = '';
        this.rdsSub = this.observabilityService.pollInfraRdsSecurity(id, region).subscribe({
            next: d => { this.rdsSecurity = d; this.rdsLoading = false; },
            error: e => { this.rdsError = e?.error?.error || 'Failed'; this.rdsLoading = false; },
        });

        this.albLoading = true; this.albError = '';
        this.albSub = this.observabilityService.pollInfraAlbSecurity(id, region).subscribe({
            next: d => { this.albSecurity = d; this.albLoading = false; },
            error: e => { this.albError = e?.error?.error || 'Failed'; this.albLoading = false; },
        });

        this.ecsLoading = true; this.ecsError = '';
        this.ecsSub = this.observabilityService.pollInfraEcsSecurity(id, region).subscribe({
            next: d => { this.ecsSecurity = d; this.ecsLoading = false; },
            error: e => { this.ecsError = e?.error?.error || 'Failed'; this.ecsLoading = false; },
        });
    }

    private resetInfraData(): void {
        this.vpcSub?.unsubscribe(); this.vpcSecurity = null; this.vpcError = '';
        this.rdsSub?.unsubscribe(); this.rdsSecurity = null; this.rdsError = '';
        this.albSub?.unsubscribe(); this.albSecurity = null; this.albError = '';
        this.ecsSub?.unsubscribe(); this.ecsSecurity = null; this.ecsError = '';
    }

    // ── Infra security status helpers ─────────────────────────────────────────

    getVpcOverallStatus(): string {
        if (!this.vpcSecurity || this.vpcSecurity.vpcs.length === 0) return 'unknown';
        return this.vpcSecurity.overall.status;
    }

    getRdsOverallStatus(): string {
        if (!this.rdsSecurity || this.rdsSecurity.instances.length === 0) return 'unknown';
        return this.rdsSecurity.overall.status;
    }

    getAlbOverallStatus(): string {
        if (!this.albSecurity || this.albSecurity.loadBalancers.length === 0) return 'unknown';
        return this.albSecurity.overall.status;
    }

    getEcsOverallStatus(): string {
        if (!this.ecsSecurity || this.ecsSecurity.clusters.length === 0) return 'unknown';
        return this.ecsSecurity.overall.status;
    }

    getSubnetTypeClass(type: string): string {
        return type === 'public' ? 'subnet-pill-pub' : 'subnet-pill-priv';
    }

    // ── VPC detail panel ──────────────────────────────────────────────────────

    openVpcDetail(vpc: any): void {
        this.selectedVpc = vpc;
        this.vpcDetail = vpc;
        this.vpcDetailLoading = false;
        this.vpcDetailError = '';
    }

    closeVpcDetail(): void {
        this.selectedVpc = null;
        this.vpcDetail = null;
        this.vpcDetailError = '';
    }

    // ── VPC row helpers ───────────────────────────────────────────────────────────

    hasHighRiskSg(vpc: any): boolean {
        // treat any open SG as high-risk; refine if your model carries a risk field
        return vpc.openSecurityGroups.length > 0;
    }

    getScorePct(overall: SecurityOverall): number {
        if (!overall || overall.total === 0) return 0;
        return Math.round((overall.passed / overall.total) * 100);
    }

    getScoreStroke(overall: SecurityOverall): string {
        const pct = this.getScorePct(overall);
        if (pct >= 80) return '#2e7d32';
        if (pct >= 50) return '#e65100';
        return '#c62828';
    }

    getScoreDash(overall: SecurityOverall): string {
        const circumference = 2 * Math.PI * 14; // r=14 matches the SVG
        const filled = circumference * (this.getScorePct(overall) / 100);
        return `${filled} ${circumference}`;
    }

    countVpcOverallByStatus(status: string): number {
        if (!this.vpcSecurity) return 0;
        return this.vpcSecurity.vpcs.reduce((acc, vpc) => {
            return acc + vpc.checks.filter((c: any) => c.status === status).length;
        }, 0);
    }

    countVpcChecksByStatus(checks: any[], status: string): number {
        return (checks || []).filter(c => c.status === status).length;
    }

    // ── RDS detail panel ──────────────────────────────────────────────────────

    countRdsOverallByStatus(status: string): number {
        if (!this.rdsSecurity) return 0;
        return this.rdsSecurity.instances.reduce((acc, db) => {
            return acc + db.checks.filter((c: any) => c.status === status).length;
        }, 0);
    }

    openRdsDetail(db: any): void {
        this.selectedRds = db;
        this.rdsDetail = db;
        this.rdsDetailLoading = false;
        this.rdsDetailError = '';
    }

    closeRdsDetail(): void {
        this.selectedRds = null;
        this.rdsDetail = null;
        this.rdsDetailError = '';
        this.copiedEndpoint = false;
    }

    copyEndpoint(endpoint: string): void {
        navigator.clipboard.writeText(endpoint).then(() => {
            this.copiedEndpoint = true;
            setTimeout(() => this.copiedEndpoint = false, 2000);
        });
    }

    // ── ALB detail panel ──────────────────────────────────────────────────────

    openAlbDetail(lb: any): void {
        this.selectedAlb = lb;
        this.albDetail = lb;
        this.albDetailLoading = false;
        this.albDetailError = '';
    }

    closeAlbDetail(): void {
        this.selectedAlb = null;
        this.albDetail = null;
        this.albDetailError = '';
        this.copiedAlbDns = false;
    }

    copyAlbDns(dns: string): void {
        navigator.clipboard.writeText(dns).then(() => {
            this.copiedAlbDns = true;
            setTimeout(() => this.copiedAlbDns = false, 2000);
        });
    }

    getAlbHealthClass(status: string): string {
        if (status === 'healthy') return 'status-healthy';
        if (status === 'degraded') return 'status-degraded';
        return 'status-unhealthy';
    }

    countAlbOverallByStatus(status: string): number {
        if (!this.albSecurity) return 0;
        return this.albSecurity.loadBalancers.reduce((acc, lb) => {
            return acc + lb.checks.filter((c: any) => c.status === status).length;
        }, 0);
    }

    copyToClipboard(text: string): void {
        navigator.clipboard.writeText(text).then(() => {
            this.copiedArn = true;
            setTimeout(() => this.copiedArn = false, 2000);
        });
    }

    // ── ECS detail panel ──────────────────────────────────────────────────────

    openEcsDetail(cluster: any): void {
        this.selectedEcsCluster = cluster;
        this.ecsDetail = cluster;
        this.ecsDetailLoading = false;
        this.ecsDetailError = '';
    }

    closeEcsDetail(): void {
        this.selectedEcsCluster = null;
        this.ecsDetail = null;
        this.ecsDetailError = '';
    }

    getEcsStatusClass(status: string): string {
        return status === 'ACTIVE' ? 'status-healthy' : 'status-unhealthy';
    }

    countEcsChecksByStatus(status: string): number {
        if (!this.ecsDetail) return 0;
        return (this.ecsDetail.services || []).reduce((acc: number, svc: any) => {
            const td = (svc.taskDefinitionChecks || []).filter((c: any) => c.status === status).length;
            const iam = (svc.iamChecks || []).filter((c: any) => c.status === status).length;
            return acc + td + iam;
        }, 0);
    }

    hasFailedCheck(checks: any[], id: string): boolean {
        return (checks || []).some((c: any) => c.id === id && c.status === 'fail');
    }

    hasWildcardIam(svc: any): boolean {
        return (svc.iamChecks || []).some((c: any) => c.id === 'wildcard-resource' && c.status === 'fail');
    }

    isPrivileged(svc: any): boolean {
        return (svc.taskDefinitionChecks || []).some((c: any) => c.id === 'no-privileged' && c.status === 'fail');
    }

    hasHardcodedSecrets(svc: any): boolean {
        return (svc.taskDefinitionChecks || []).some((c: any) => c.id === 'secrets-manager' && c.status === 'fail');
    }

    hasReadonlyRootFs(svc: any): boolean {
        return (svc.taskDefinitionChecks || []).some((c: any) => c.id === 'readonly-root-fs' && c.status !== 'fail');
    }

    getTaskStatusClass2(status: string): string {
        const s = (status || '').toUpperCase();
        if (s === 'RUNNING') return 'task-running';
        if (s === 'STOPPED') return 'task-stopped';
        return 'task-pending';
    }

    getSubnetsByType(vpc: any, type: 'public' | 'private'): number {
        return (vpc.subnets || []).filter((s: any) => s.type === type).length;
    }

    // ── Apps tab ──────────────────────────────────────────────────────────────

    loadDeployments(): void {
        this.http.get<any[]>(this.apiBase + 'deployments/list').subscribe({
            next: (res) => {
                this.deployments = res || [];
                this.startPollingAll();
            },
            error: () => {
                this.deployments = [];
                this.startPollingAll();
            }
        });
    }

    startPollingAll(): void {
        this.allHealthLoading = true;
        this.allSub = this.observabilityService.pollAllDeploymentsHealth().subscribe({
            next: (data) => {
                this.allHealth = data;
                this.allHealthLoading = false;
                this.allHealthError = '';
            },
            error: (err) => {
                this.allHealthLoading = false;
                this.allHealthError = err?.error?.error || 'Failed to fetch security data';
            }
        });
    }

    openDetail(summary: any): void {
        const deployment = this.deployments.find(d => d.id === summary.id);
        if (!deployment) return;

        this.selectedDeployment = deployment;
        this.detailHealth = null;
        this.detailLoading = true;
        this.detailError = '';

        this.detailSub?.unsubscribe();
        this.detailSub = this.observabilityService.pollServiceHealth(
            deployment.accountID,
            deployment.region,
            deployment.ecsCluster,
            deployment.name
        ).subscribe({
            next: (data) => {
                this.detailHealth = data;
                this.detailLoading = false;
                this.detailError = '';
            },
            error: (err) => {
                this.detailLoading = false;
                this.detailError = err?.error?.error || 'Failed to fetch deployment security detail';
            }
        });
    }

    closeDetail(): void {
        this.detailSub?.unsubscribe();
        this.selectedDeployment = null;
        this.detailHealth = null;
        this.detailError = '';
    }

    // ── Shared status helpers ─────────────────────────────────────────────────

    getStatusClass(status: string): string {
        switch (status) {
            case 'healthy': return 'status-healthy';
            case 'degraded': return 'status-degraded';
            case 'unhealthy': return 'status-unhealthy';
            default: return 'status-unknown';
        }
    }

    getStatusLabel(status: string): string {
        switch (status) {
            case 'healthy': return 'Secure';
            case 'degraded': return 'At Risk';
            case 'unhealthy': return 'Vulnerable';
            default: return 'Unknown';
        }
    }

    getStatusIcon(status: string): string {
        switch (status) {
            case 'healthy': return '●';
            case 'degraded': return '◐';
            case 'unhealthy': return '●';
            default: return '○';
        }
    }

    getMetricBarWidth(value: number | null): string {
        if (value === null) return '0%';
        return Math.min(value, 100) + '%';
    }

    getMetricBarClass(value: number | null): string {
        if (value === null) return '';
        if (value >= 85) return 'bar-danger';
        if (value >= 65) return 'bar-warning';
        return 'bar-ok';
    }

    formatDate(date: string | null): string {
        if (!date) return '—';
        return new Date(date).toLocaleString();
    }

    getTaskStatusClass(status: string): string {
        const s = (status || '').toUpperCase();
        if (s === 'RUNNING') return 'task-running';
        if (s === 'STOPPED') return 'task-stopped';
        return 'task-pending';
    }

    countByStatus(status: string): number {
        return this.allHealth.filter(h => h.status === status).length;
    }

    // ── Security-specific helpers ─────────────────────────────────────────────

    scoreClass(overall: SecurityOverall | null): string {
        if (!overall) return 'status-unknown';
        if (overall.status === 'healthy') return 'status-healthy';
        if (overall.status === 'degraded') return 'status-degraded';
        if (overall.status === 'unhealthy') return 'status-unhealthy';
        return 'status-unknown';
    }

    secStatusIcon(status: string): string {
        if (status === 'healthy') return '●';
        if (status === 'degraded') return '◐';
        if (status === 'unhealthy') return '●';
        return '○';
    }

    checkIcon(status: string): string {
        if (status === 'pass') return '✓';
        if (status === 'fail') return '✗';
        return '⚠';
    }

    checkClass(status: string): string {
        if (status === 'pass') return 'check-pass';
        if (status === 'fail') return 'check-fail';
        return 'check-warn';
    }

    countFails(checks: SecurityCheck[]): number {
        return (checks || []).filter(c => c.status === 'fail').length;
    }
}
