import { Component, OnInit, OnDestroy } from '@angular/core';
import { Subscription } from 'rxjs';
import { ObservabilityService } from '../services/observability.service';
import { ObservabilityHealth } from '../models/observability.model';

const ACP_REGION = 'us-east-1';
const ACP_CLUSTER = 'acp-cluster';
const ACP_BACKEND_SERVICE = 'acp-backend-service';
const ACP_FRONTEND_SERVICE = 'acp-frontend-service';

@Component({
    selector: 'app-acp-portal-health',
    templateUrl: './acp-portal-health.component.html',
    styleUrls: ['./acp-portal-health.component.css']
})
export class AcpPortalHealthComponent implements OnInit, OnDestroy {

    backendHealth: ObservabilityHealth | null = null;
    frontendHealth: ObservabilityHealth | null = null;

    backendLoading = true;
    frontendLoading = true;

    backendError = '';
    frontendError = '';

    private backendSub: Subscription | null = null;
    private frontendSub: Subscription | null = null;

    constructor(private observabilityService: ObservabilityService) { }

    ngOnInit(): void {
        this.backendSub = this.observabilityService.pollAcpPortalHealth(
            ACP_REGION, ACP_CLUSTER, ACP_BACKEND_SERVICE
        ).subscribe({
            next: (data) => {
                this.backendHealth = data;
                this.backendLoading = false;
                this.backendError = '';
            },
            error: (err) => {
                this.backendLoading = false;
                this.backendError = err?.error?.error || 'Failed to fetch backend health';
            }
        });

        this.frontendSub = this.observabilityService.pollAcpPortalHealth(
            ACP_REGION, ACP_CLUSTER, ACP_FRONTEND_SERVICE
        ).subscribe({
            next: (data) => {
                this.frontendHealth = data;
                this.frontendLoading = false;
                this.frontendError = '';
            },
            error: (err) => {
                this.frontendLoading = false;
                this.frontendError = err?.error?.error || 'Failed to fetch frontend health';
            }
        });
    }

    ngOnDestroy(): void {
        this.backendSub?.unsubscribe();
        this.frontendSub?.unsubscribe();
    }

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
}
