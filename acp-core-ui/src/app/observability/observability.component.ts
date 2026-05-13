import { Component, OnInit, OnDestroy } from '@angular/core';
import { Subscription } from 'rxjs';
import { ObservabilityService } from '../services/observability.service';
import { CloudAccountService, CloudAccount } from '../services/cloud-account.service';
import {
    ObservabilityHealth,
    DeploymentHealthSummary,
    VpcHealthPayload,
    RdsHealthPayload,
    AlbHealthPayload,
    EcsHealthPayload,
} from '../models/observability.model';
import { HttpClient } from '@angular/common/http';
import { EnvService } from 'src/environments/env.service';

@Component({
    selector: 'app-observability',
    templateUrl: './observability.component.html',
    styleUrls: ['./observability.component.css']
})
export class ObservabilityComponent implements OnInit, OnDestroy {

    // ── Tab state ─────────────────────────────────────────────────────────────
    activeTab: 'infra' | 'apps' = 'infra';

    // ── Cloud accounts (to drive infra region) ────────────────────────────────
    cloudAccounts: CloudAccount[] = [];
    selectedAccount: CloudAccount | null = null;

    // ── Infra tab state ───────────────────────────────────────────────────────
    activeInfraCard: 'vpc' | 'rds' | 'alb' | 'ecs' | null = null;

    vpcHealth: VpcHealthPayload | null = null;
    vpcLoading = false;
    vpcError = '';
    private vpcSub: Subscription | null = null;

    rdsHealth: RdsHealthPayload | null = null;
    rdsLoading = false;
    rdsError = '';
    private rdsSub: Subscription | null = null;

    albHealth: AlbHealthPayload | null = null;
    albLoading = false;
    albError = '';
    private albSub: Subscription | null = null;

    ecsHealth: EcsHealthPayload | null = null;
    ecsLoading = false;
    ecsError = '';
    private ecsSub: Subscription | null = null;

    // ── Apps tab state (all existing — untouched) ─────────────────────────────
    allHealth: DeploymentHealthSummary[] = [];
    allHealthLoading = true;
    allHealthError = '';

    selectedDeployment: any = null;
    detailHealth: ObservabilityHealth | null = null;
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
            return;
        }

        if (card === 'vpc') {
            this.vpcSub?.unsubscribe();
            this.vpcLoading = true;
            this.vpcError = '';
            this.vpcSub = this.observabilityService.pollInfraVpcHealth(accountId, region).subscribe({
                next: (data) => { this.vpcHealth = data; this.vpcLoading = false; },
                error: (err) => { this.vpcError = err?.error?.error || 'Failed to load VPC health'; this.vpcLoading = false; }
            });
        }

        if (card === 'rds') {
            this.rdsSub?.unsubscribe();
            this.rdsLoading = true;
            this.rdsError = '';
            this.rdsSub = this.observabilityService.pollInfraRdsHealth(accountId, region).subscribe({
                next: (data) => { this.rdsHealth = data; this.rdsLoading = false; },
                error: (err) => { this.rdsError = err?.error?.error || 'Failed to load RDS health'; this.rdsLoading = false; }
            });
        }

        if (card === 'alb') {
            this.albSub?.unsubscribe();
            this.albLoading = true;
            this.albError = '';
            this.albSub = this.observabilityService.pollInfraAlbHealth(accountId, region).subscribe({
                next: (data) => { this.albHealth = data; this.albLoading = false; },
                error: (err) => { this.albError = err?.error?.error || 'Failed to load ALB health'; this.albLoading = false; }
            });
        }

        if (card === 'ecs') {
            this.ecsSub?.unsubscribe();
            this.ecsLoading = true;
            this.ecsError = '';
            this.ecsSub = this.observabilityService.pollInfraEcsHealth(accountId, region).subscribe({
                next: (data) => { this.ecsHealth = data; this.ecsLoading = false; },
                error: (err) => { this.ecsError = err?.error?.error || 'Failed to load ECS health'; this.ecsLoading = false; }
            });
        }
    }

    private resetInfraData(): void {
        this.vpcSub?.unsubscribe(); this.vpcHealth = null; this.vpcError = '';
        this.rdsSub?.unsubscribe(); this.rdsHealth = null; this.rdsError = '';
        this.albSub?.unsubscribe(); this.albHealth = null; this.albError = '';
        this.ecsSub?.unsubscribe(); this.ecsHealth = null; this.ecsError = '';
    }

    // ── Infra status helpers ──────────────────────────────────────────────────

    getVpcOverallStatus(): string {
        if (!this.vpcHealth || this.vpcHealth.vpcs.length === 0) return 'unknown';
        return this.vpcHealth.vpcs.every(v => v.state === 'available') ? 'healthy' : 'degraded';
    }

    getRdsOverallStatus(): string {
        if (!this.rdsHealth || this.rdsHealth.instances.length === 0) return 'unknown';
        return this.rdsHealth.instances.every(i => i.status === 'available') ? 'healthy' : 'degraded';
    }

    getAlbOverallStatus(): string {
        if (!this.albHealth || this.albHealth.loadBalancers.length === 0) return 'unknown';
        for (const lb of this.albHealth.loadBalancers) {
            if (lb.state !== 'active') return 'unhealthy';
            for (const tg of lb.targetGroups) {
                if (tg.healthy < tg.total) return 'degraded';
            }
        }
        return 'healthy';
    }

    getEcsOverallStatus(): string {
        if (!this.ecsHealth || this.ecsHealth.clusters.length === 0) return 'unknown';
        return this.ecsHealth.clusters.every(c => c.status === 'ACTIVE') ? 'healthy' : 'degraded';
    }

    getSubnetTypeClass(type: string): string {
        return type === 'public' ? 'subnet-pill-pub' : 'subnet-pill-priv';
    }

    // ── Apps tab — all existing logic untouched ───────────────────────────────

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
                this.allHealthError = err?.error?.error || 'Failed to fetch health data';
            }
        });
    }

    openDetail(summary: DeploymentHealthSummary): void {
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
                this.detailError = err?.error?.error || 'Failed to fetch service detail';
            }
        });
    }

    closeDetail(): void {
        this.detailSub?.unsubscribe();
        this.selectedDeployment = null;
        this.detailHealth = null;
        this.detailError = '';
    }

    // ── Shared helpers (all existing — untouched) ─────────────────────────────

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
            case 'healthy': return 'Healthy';
            case 'degraded': return 'Degraded';
            case 'unhealthy': return 'Unhealthy';
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
}
