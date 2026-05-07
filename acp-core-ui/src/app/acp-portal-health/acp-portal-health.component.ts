import { Component, OnInit, OnDestroy } from '@angular/core';
import { Subscription } from 'rxjs';
import { ObservabilityService } from '../services/observability.service';
import {
    ObservabilityHealth,
    VpcHealthPayload,
    RdsHealthPayload,
    AlbHealthPayload
} from '../models/observability.model';

const ACP_REGION = 'us-east-1';
const ACP_CLUSTER = 'acp-cluster';
const ACP_BACKEND_SERVICE = 'acp-backend-service';
const ACP_FRONTEND_SERVICE = 'acp-frontend-service';

export type ResourceTab = 'ecs' | 'vpc' | 'rds' | 'alb';

@Component({
    selector: 'app-acp-portal-health',
    templateUrl: './acp-portal-health.component.html',
    styleUrls: ['./acp-portal-health.component.css']
})
export class AcpPortalHealthComponent implements OnInit, OnDestroy {

    activeTab: ResourceTab | null = null;

    // ECS
    backendHealth: ObservabilityHealth | null = null;
    frontendHealth: ObservabilityHealth | null = null;
    backendLoading = true;
    frontendLoading = true;
    backendError = '';
    frontendError = '';

    // VPC
    vpcHealth: VpcHealthPayload | null = null;
    vpcLoading = false;
    vpcError = '';

    // RDS
    rdsHealth: RdsHealthPayload | null = null;
    rdsLoading = false;
    rdsError = '';

    // ALB
    albHealth: AlbHealthPayload | null = null;
    albLoading = false;
    albError = '';

    private subs: Subscription[] = [];

    constructor(private observabilityService: ObservabilityService) { }

    ngOnInit(): void {
        // Always start polling ECS (lightweight summary needed for top cards)
        this.subs.push(
            this.observabilityService.pollAcpPortalHealth(ACP_REGION, ACP_CLUSTER, ACP_BACKEND_SERVICE).subscribe({
                next: d => { this.backendHealth = d; this.backendLoading = false; this.backendError = ''; },
                error: e => { this.backendLoading = false; this.backendError = e?.error?.error || 'Failed'; }
            }),
            this.observabilityService.pollAcpPortalHealth(ACP_REGION, ACP_CLUSTER, ACP_FRONTEND_SERVICE).subscribe({
                next: d => { this.frontendHealth = d; this.frontendLoading = false; this.frontendError = ''; },
                error: e => { this.frontendLoading = false; this.frontendError = e?.error?.error || 'Failed'; }
            })
        );
    }

    selectTab(tab: ResourceTab): void {
        // Toggle off if same tab clicked again
        if (this.activeTab === tab) { this.activeTab = null; return; }
        this.activeTab = tab;

        if (tab === 'vpc' && !this.vpcHealth && !this.vpcLoading) {
            this.vpcLoading = true;
            this.subs.push(
                this.observabilityService.pollAcpVpcHealth(ACP_REGION).subscribe({
                    next: d => { this.vpcHealth = d; this.vpcLoading = false; this.vpcError = ''; },
                    error: e => { this.vpcLoading = false; this.vpcError = e?.error?.error || 'Failed to fetch VPC health'; }
                })
            );
        }

        if (tab === 'rds' && !this.rdsHealth && !this.rdsLoading) {
            this.rdsLoading = true;
            this.subs.push(
                this.observabilityService.pollAcpRdsHealth(ACP_REGION).subscribe({
                    next: d => { this.rdsHealth = d; this.rdsLoading = false; this.rdsError = ''; },
                    error: e => { this.rdsLoading = false; this.rdsError = e?.error?.error || 'Failed to fetch RDS health'; }
                })
            );
        }

        if (tab === 'alb' && !this.albHealth && !this.albLoading) {
            this.albLoading = true;
            this.subs.push(
                this.observabilityService.pollAcpAlbHealth(ACP_REGION).subscribe({
                    next: d => { this.albHealth = d; this.albLoading = false; this.albError = ''; },
                    error: e => { this.albLoading = false; this.albError = e?.error?.error || 'Failed to fetch ALB health'; }
                })
            );
        }
    }

    ngOnDestroy(): void {
        this.subs.forEach(s => s.unsubscribe());
    }

    // ── Helpers (keep all existing ones) ────────────────────────────────────
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

    // ── New helpers ────────────────────────────────────────────────────────
    getRdsStatusClass(status: string): string {
        if (status === 'available') return 'status-healthy';
        if (['backing-up', 'modifying', 'starting'].includes(status)) return 'status-degraded';
        return 'status-unhealthy';
    }
    getAlbStateClass(state: string): string {
        if (state === 'active') return 'status-healthy';
        if (state === 'provisioning') return 'status-degraded';
        return 'status-unhealthy';
    }

    // Overall summary status for each resource card
    get ecsOverallStatus(): string {
        const statuses = [this.backendHealth?.status, this.frontendHealth?.status].filter(Boolean) as string[];
        if (statuses.includes('unhealthy')) return 'unhealthy';
        if (statuses.includes('degraded')) return 'degraded';
        if (statuses.length && statuses.every(s => s === 'healthy')) return 'healthy';
        return 'unknown';
    }
    get vpcOverallStatus(): string {
        if (!this.vpcHealth) return 'unknown';
        return this.vpcHealth.vpcs.every(v => v.state === 'available') ? 'healthy' : 'degraded';
    }
    get rdsOverallStatus(): string {
        if (!this.rdsHealth) return 'unknown';
        if (!this.rdsHealth.instances.length) return 'unknown';
        return this.rdsHealth.instances.every(i => i.status === 'available') ? 'healthy' : 'degraded';
    }
    get albOverallStatus(): string {
        if (!this.albHealth) return 'unknown';
        const allActive = this.albHealth.loadBalancers.every(lb => lb.state === 'active');
        return allActive ? 'healthy' : 'degraded';
    }
}