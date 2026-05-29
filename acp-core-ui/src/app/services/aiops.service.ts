import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { EnvService } from 'src/environments/env.service';

@Injectable({ providedIn: 'root' })
export class AiopsService {

    private apiBase: string = '';
    lastActiveSection: 'findings' | 'approvals' | 'resolution' | 'runs' = 'findings';

    // ── Persisted last scan state (survives navigation) ──────────────────
    lastScanResult: any = null;
    lastScanMeta: any = null;
    lastInfraFindings: any[] = [];
    lastAppFindings: any[] = [];
    lastActionsTaken: any[] = [];
    lastPendingApprovals: any[] = [];
    lastRunAt: Date | null = null;
    lastScanDurationMs: number | null = null;
    lastSessionId: string = '';
    lastScanMetaRaw: any = {};

    constructor(private http: HttpClient, private envService: EnvService) {
        this.apiBase = this.envService.apiUrl;
    }

    // Trigger a new AI Ops scan — passes accountId + region from the user's cloud account
    runScan(mode: 'observe' | 'full' | 'remediate-only', accountId: string, region: string): Observable<any> {
        return this.http.post(`${this.apiBase}aiops/run`, { mode, accountId, region });
    }

    // Approve or reject a pending remediation action
    approveAction(sessionId: string, approved: boolean, action: string, target: string,
        accountId?: string, region?: string, desiredCount?: number, reason?: string): Observable<any> {
        return this.http.post(`${this.apiBase}aiops/approve`, {
            sessionId, approved, action, target, accountId, region, desiredCount, reason
        });
    }

    // Fetch incident list
    getIncidents(status?: string): Observable<any[]> {
        const params: any = {};
        if (status) params['status'] = status;
        return this.http.get<any[]>(`${this.apiBase}aiops/incidents`, { params });
    }

    // Update incident status
    updateIncident(id: number, status: string): Observable<any> {
        return this.http.patch(`${this.apiBase}aiops/incidents/${id}`, { status });
    }

    getScanRuns(): Observable<any[]> {
        return this.http.get<any[]>(`${this.apiBase}aiops/runs`);
    }
}
