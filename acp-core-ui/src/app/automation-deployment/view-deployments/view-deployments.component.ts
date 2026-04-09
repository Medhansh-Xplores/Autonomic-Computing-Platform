import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { EnvService } from 'src/environments/env.service';

@Component({
    selector: 'app-view-deployments',
    templateUrl: './view-deployments.component.html',
    styleUrls: ['./view-deployments.component.css']
})
export class ViewDeploymentsComponent implements OnInit {

    deployments: any[] = [];
    apiBase: string = '';

    constructor(
        private http: HttpClient,
        private envService: EnvService
    ) { }

    ngOnInit(): void {

        this.apiBase = this.envService.apiUrl;

        this.loadDeployments();

        setInterval(() => {
            this.loadDeployments();
        }, 3000);
    }

    loadDeployments() {

        this.http.get(this.apiBase + 'deployments/list')
            .subscribe((res: any) => {
                this.deployments = res;
            });

    }
    getStatusLabel(d: any): string {
        const s = (d?.status || '').toLowerCase();
        if (s === 'failed') return 'Failed';
        if (s === 'deployed' || s === 'active' || s === 'completed') return 'Deployed';
        return 'Running';
    }

    getStatusClass(d: any): string {
        const s = (d?.status || '').toLowerCase();
        if (s === 'failed') return 'failed';
        if (s === 'deployed' || s === 'active' || s === 'completed') return 'completed';
        return 'running';
    }

}