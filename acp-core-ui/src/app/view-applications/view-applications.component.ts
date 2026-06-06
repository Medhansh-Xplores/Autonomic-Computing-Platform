import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { EnvService } from 'src/environments/env.service';

@Component({
    selector: 'app-view-applications',
    templateUrl: './view-applications.component.html',
    styleUrls: ['./view-applications.component.css']
})
export class ViewApplicationsComponent implements OnInit {

    applications: any[] = [];
    apiBase: string = '';

    constructor(
        private http: HttpClient,
        private envService: EnvService
    ) { }

    ngOnInit(): void {
        this.apiBase = this.envService.apiUrl;
        this.loadApplications();
    }

    loadApplications(): void {
        this.http.get<any[]>(this.apiBase + 'applications/list')
            .subscribe({
                next: (res) => { this.applications = res; },
                error: (err) => { console.error('Failed to load applications', err); }
            });
    }

    getStatusClass(app: any): string {
        const s = (app?.status || '').toLowerCase();
        if (s === 'failed') return 'failed';
        if (s === 'generating') return 'running';
        return 'completed';
    }

    getStatusLabel(app: any): string {
        const s = (app?.status || '').toLowerCase();
        if (s === 'failed') return 'Failed';
        if (s === 'generating') return 'Generating';
        return 'Completed';
    }

    deleteApplication(event: Event, app: any): void {
        event.stopPropagation();
        if (!confirm(`Delete application "${app.app_name}"? This will remove the record.`)) return;
        this.http.delete(this.apiBase + 'applications/record/' + app.id).subscribe({
            next: () => {
                this.applications = this.applications.filter(a => a.id !== app.id);
            },
            error: (err) => { console.error('Delete failed', err); }
        });
    }
}