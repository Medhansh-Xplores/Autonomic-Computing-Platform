import { Component, OnInit, OnDestroy } from '@angular/core';
import { Subscription } from 'rxjs';
import { ObservabilityService } from '../services/observability.service';
import { ObservabilityHealth, DeploymentHealthSummary } from '../models/observability.model';
import { HttpClient } from '@angular/common/http';
import { EnvService } from 'src/environments/env.service';

@Component({
    selector: 'app-observability',
    templateUrl: './observability.component.html',
    styleUrls: ['./observability.component.css']
})
export class ObservabilityComponent implements OnInit, OnDestroy {

    // All deployments lightweight summary
    allHealth: DeploymentHealthSummary[] = [];
    allHealthLoading: boolean = true;
    allHealthError: string = '';

    // Detailed view for selected deployment
    selectedDeployment: any = null;
    detailHealth: ObservabilityHealth | null = null;
    detailLoading: boolean = false;
    detailError: string = '';

    // All deployments from DB (to get account/region/cluster metadata)
    deployments: any[] = [];

    private allSub: Subscription | null = null;
    private detailSub: Subscription | null = null;

    apiBase: string = '';

    constructor(
        private observabilityService: ObservabilityService,
        private http: HttpClient,
        private envService: EnvService
    ) { }

    ngOnInit(): void {
        this.apiBase = this.envService.apiUrl;
        this.loadDeployments();
    }

    ngOnDestroy(): void {
        this.allSub?.unsubscribe();
        this.detailSub?.unsubscribe();
    }

    // Load deployment metadata from existing deployments API
    loadDeployments() {
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

    // Start polling lightweight health for all deployments
    startPollingAll() {
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

    // Open detailed view for a deployment
    openDetail(summary: DeploymentHealthSummary) {
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

    closeDetail() {
        this.detailSub?.unsubscribe();
        this.selectedDeployment = null;
        this.detailHealth = null;
        this.detailError = '';
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

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
