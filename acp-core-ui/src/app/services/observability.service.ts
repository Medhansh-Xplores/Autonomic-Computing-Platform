import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, timer } from 'rxjs';
import { switchMap, shareReplay } from 'rxjs/operators';
import { EnvService } from 'src/environments/env.service';
import {
    ObservabilityHealth, DeploymentHealthSummary,
    VpcHealthPayload, RdsHealthPayload, AlbHealthPayload, EcsHealthPayload
} from '../models/observability.model';

@Injectable({
    providedIn: 'root'
})
export class ObservabilityService {

    private apiBase: string = '';

    constructor(
        private http: HttpClient,
        private envService: EnvService
    ) {
        this.apiBase = this.envService.apiUrl;
    }

    // ── Detailed health for one ECS service (generic) ─────────────────────────
    getServiceHealth(account: string, region: string, cluster: string, service: string): Observable<ObservabilityHealth> {
        const params = new HttpParams()
            .set('account', account)
            .set('region', region)
            .set('cluster', cluster)
            .set('service', service);

        return this.http.get<ObservabilityHealth>(
            `${this.apiBase}observability/health`,
            { params }
        );
    }

    pollServiceHealth(account: string, region: string, cluster: string, service: string): Observable<ObservabilityHealth> {
        return timer(0, 30000).pipe(
            switchMap(() => this.getServiceHealth(account, region, cluster, service)),
            shareReplay(1)
        );
    }

    // ── ACP Portal health (account fixed on backend to 377122171982) ──────────
    getAcpPortalHealth(region: string, cluster: string, service: string): Observable<ObservabilityHealth> {
        const params = new HttpParams()
            .set('region', region)
            .set('cluster', cluster)
            .set('service', service);

        return this.http.get<ObservabilityHealth>(
            `${this.apiBase}observability/acp-portal-health`,
            { params }
        );
    }

    pollAcpPortalHealth(region: string, cluster: string, service: string): Observable<ObservabilityHealth> {
        return timer(0, 30000).pipe(
            switchMap(() => this.getAcpPortalHealth(region, cluster, service)),
            shareReplay(1)
        );
    }

    // ── Lightweight health summary for all deployments ────────────────────────
    getAllDeploymentsHealth(): Observable<DeploymentHealthSummary[]> {
        return this.http.get<DeploymentHealthSummary[]>(
            `${this.apiBase}observability/deployments-health`
        );
    }

    pollAllDeploymentsHealth(): Observable<DeploymentHealthSummary[]> {
        return timer(0, 30000).pipe(
            switchMap(() => this.getAllDeploymentsHealth()),
            shareReplay(1)
        );
    }

    // ── ACP Portal VPC health ─────────────────────────────────────────────────────
    getAcpVpcHealth(region: string): Observable<VpcHealthPayload> {
        const params = new HttpParams().set('region', region);
        return this.http.get<VpcHealthPayload>(`${this.apiBase}observability/acp-portal-vpc-health`, { params });
    }

    pollAcpVpcHealth(region: string): Observable<VpcHealthPayload> {
        return timer(0, 60000).pipe(
            switchMap(() => this.getAcpVpcHealth(region)),
            shareReplay(1)
        );
    }

    // ── ACP Portal RDS health ─────────────────────────────────────────────────────
    getAcpRdsHealth(region: string): Observable<RdsHealthPayload> {
        const params = new HttpParams().set('region', region);
        return this.http.get<RdsHealthPayload>(`${this.apiBase}observability/acp-portal-rds-health`, { params });
    }

    pollAcpRdsHealth(region: string): Observable<RdsHealthPayload> {
        return timer(0, 60000).pipe(
            switchMap(() => this.getAcpRdsHealth(region)),
            shareReplay(1)
        );
    }

    // ── ACP Portal ALB health ─────────────────────────────────────────────────────
    getAcpAlbHealth(region: string): Observable<AlbHealthPayload> {
        const params = new HttpParams().set('region', region);
        return this.http.get<AlbHealthPayload>(`${this.apiBase}observability/acp-portal-alb-health`, { params });
    }

    pollAcpAlbHealth(region: string): Observable<AlbHealthPayload> {
        return timer(0, 60000).pipe(
            switchMap(() => this.getAcpAlbHealth(region)),
            shareReplay(1)
        );
    }

    // ADD after pollAcpAlbHealth():

    // ── User infra VPC health (account-scoped, no acp- prefix filter) ────────────
    getInfraVpcHealth(accountId: string, region: string): Observable<VpcHealthPayload> {
        const params = new HttpParams().set('accountId', accountId).set('region', region);
        return this.http.get<VpcHealthPayload>(`${this.apiBase}observability/infra-vpc-health`, { params });
    }

    pollInfraVpcHealth(accountId: string, region: string): Observable<VpcHealthPayload> {
        return timer(0, 60000).pipe(
            switchMap(() => this.getInfraVpcHealth(accountId, region)),
            shareReplay(1)
        );
    }

    // ── User infra RDS health ─────────────────────────────────────────────────────
    getInfraRdsHealth(accountId: string, region: string): Observable<RdsHealthPayload> {
        const params = new HttpParams().set('accountId', accountId).set('region', region);
        return this.http.get<RdsHealthPayload>(`${this.apiBase}observability/infra-rds-health`, { params });
    }

    pollInfraRdsHealth(accountId: string, region: string): Observable<RdsHealthPayload> {
        return timer(0, 60000).pipe(
            switchMap(() => this.getInfraRdsHealth(accountId, region)),
            shareReplay(1)
        );
    }

    // ── User infra ALB health ─────────────────────────────────────────────────────
    getInfraAlbHealth(accountId: string, region: string): Observable<AlbHealthPayload> {
        const params = new HttpParams().set('accountId', accountId).set('region', region);
        return this.http.get<AlbHealthPayload>(`${this.apiBase}observability/infra-alb-health`, { params });
    }

    pollInfraAlbHealth(accountId: string, region: string): Observable<AlbHealthPayload> {
        return timer(0, 60000).pipe(
            switchMap(() => this.getInfraAlbHealth(accountId, region)),
            shareReplay(1)
        );
    }

    // ── User infra ECS health ─────────────────────────────────────────────────────
    getInfraEcsHealth(accountId: string, region: string): Observable<EcsHealthPayload> {
        const params = new HttpParams().set('accountId', accountId).set('region', region);
        return this.http.get<EcsHealthPayload>(`${this.apiBase}observability/infra-ecs-health`, { params });
    }

    pollInfraEcsHealth(accountId: string, region: string): Observable<EcsHealthPayload> {
        return timer(0, 60000).pipe(
            switchMap(() => this.getInfraEcsHealth(accountId, region)),
            shareReplay(1)
        );
    }


}
