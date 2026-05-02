import { Component, OnInit, OnDestroy } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { EnvService } from 'src/environments/env.service';

@Component({
    selector: 'app-view-deployments',
    templateUrl: './view-deployments.component.html',
    styleUrls: ['./view-deployments.component.css']
})
export class ViewDeploymentsComponent implements OnInit, OnDestroy {

    deployments: any[] = [];
    apiBase: string = '';
    private interval: any;

    constructor(
        private http: HttpClient,
        private envService: EnvService
    ) { }

    ngOnInit(): void {
        this.apiBase = this.envService.apiUrl;
        this.loadDeployments();
        this.interval = setInterval(() => this.loadDeployments(), 5000);
    }

    ngOnDestroy(): void {
        clearInterval(this.interval);
    }

    loadDeployments() {
        this.http.get<any[]>(this.apiBase + 'deployments/list')
            .subscribe((res: any) => {
                this.deployments = res;
            });
    }

    getStatusLabel(d: any): string {
        const s = (d?.status || '').toLowerCase();
        if (s === 'failed') return 'Failed';
        if (s === 'deleting') return 'Deleting';
        if (s === 'delete failed') return 'Delete Failed';
        if (s === 'deployed' || s === 'active' || s === 'completed') return 'Deployed';
        return 'Running';
    }

    getStatusClass(d: any): string {
        const s = (d?.status || '').toLowerCase();
        if (s === 'failed' || s === 'delete failed') return 'failed';
        if (s === 'deleting') return 'running';   // reuse orange/spinner style
        if (s === 'deployed' || s === 'active' || s === 'completed') return 'completed';
        return 'running';
    }

    deleteDeployment(event: Event, d: any) {
        event.stopPropagation();
        if (!confirm(`Delete deployment "${d.name}"? This will destroy the ECS app infrastructure and remove the record.`)) return;
        d.status = 'Deleting';
        this.http.delete(this.apiBase + 'deployments/record/' + d.id).subscribe({
            next: () => {
                // Don't remove immediately — destroy runs in background, polling will reflect status
            },
            error: (err) => {
                console.error('Delete failed', err);
                d.status = 'Delete Failed';
            }
        });
    }
}