import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, timer } from 'rxjs';
import { switchMap, shareReplay } from 'rxjs/operators';
import { EnvService } from 'src/environments/env.service';
import {
    AcpSecurityPosture,
    VpcSecurityPayload,
    RdsSecurityPayload,
    AlbSecurityPayload,
    EcsSecurityPayload
} from '../models/security.model';
import {
    ObservabilityHealth, DeploymentHealthSummary,
    VpcHealthPayload, RdsHealthPayload, AlbHealthPayload, EcsHealthPayload,
    VpcDetailPayload,
    RdsDetailPayload,
    AlbDetailPayload,
    EcsDetailPayload
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

    getAcpSecurityPosture(region: string = 'us-east-1', cluster: string = 'acp-cluster'): Observable<AcpSecurityPosture> {
        const params = new HttpParams()
            .set('region', region)
            .set('cluster', cluster);
        return this.http.get<AcpSecurityPosture>(
            `${this.apiBase}security/acp-security-posture`,
            { params }
        );
    }

    pollAcpSecurityPosture(region: string = 'us-east-1', cluster: string = 'acp-cluster'): Observable<AcpSecurityPosture> {
        return timer(0, 60000).pipe(
            switchMap(() => this.getAcpSecurityPosture(region, cluster)),
            shareReplay(1)
        );
    }

    getInfraVpcSecurity(accountId: string, region: string): Observable<VpcSecurityPayload> {
        const params = new HttpParams().set('accountId', accountId).set('region', region);
        return this.http.get<VpcSecurityPayload>(`${this.apiBase}security/infra-vpc-security`, { params });
    }

    pollInfraVpcSecurity(accountId: string, region: string): Observable<VpcSecurityPayload> {
        return timer(0, 60000).pipe(
            switchMap(() => this.getInfraVpcSecurity(accountId, region)),
            shareReplay(1)
        );
    }

    getInfraRdsSecurity(accountId: string, region: string): Observable<RdsSecurityPayload> {
        const params = new HttpParams().set('accountId', accountId).set('region', region);
        return this.http.get<RdsSecurityPayload>(`${this.apiBase}security/infra-rds-security`, { params });
    }

    pollInfraRdsSecurity(accountId: string, region: string): Observable<RdsSecurityPayload> {
        return timer(0, 60000).pipe(
            switchMap(() => this.getInfraRdsSecurity(accountId, region)),
            shareReplay(1)
        );
    }

    getInfraAlbSecurity(accountId: string, region: string): Observable<AlbSecurityPayload> {
        const params = new HttpParams().set('accountId', accountId).set('region', region);
        return this.http.get<AlbSecurityPayload>(`${this.apiBase}security/infra-alb-security`, { params });
    }

    pollInfraAlbSecurity(accountId: string, region: string): Observable<AlbSecurityPayload> {
        return timer(0, 60000).pipe(
            switchMap(() => this.getInfraAlbSecurity(accountId, region)),
            shareReplay(1)
        );
    }

    getInfraEcsSecurity(accountId: string, region: string): Observable<EcsSecurityPayload> {
        const params = new HttpParams().set('accountId', accountId).set('region', region);
        return this.http.get<EcsSecurityPayload>(`${this.apiBase}security/infra-ecs-security`, { params });
    }

    pollInfraEcsSecurity(accountId: string, region: string): Observable<EcsSecurityPayload> {
        return timer(0, 60000).pipe(
            switchMap(() => this.getInfraEcsSecurity(accountId, region)),
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

    // ── User infra VPC detail (single VPC drill-down) ─────────────────────────────
    getInfraVpcDetail(accountId: string, region: string, vpcId: string): Observable<VpcDetailPayload> {
        const params = new HttpParams()
            .set('accountId', accountId)
            .set('region', region)
            .set('vpcId', vpcId);
        return this.http.get<VpcDetailPayload>(`${this.apiBase}observability/infra-vpc-detail`, { params });
    }

    // ── User infra RDS detail ─────────────────────────────────────────────────────
    getInfraRdsDetail(accountId: string, region: string, dbIdentifier: string): Observable<RdsDetailPayload> {
        const params = new HttpParams()
            .set('accountId', accountId)
            .set('region', region)
            .set('dbIdentifier', dbIdentifier);
        return this.http.get<RdsDetailPayload>(`${this.apiBase}observability/infra-rds-detail`, { params });
    }

    // ── User infra ALB detail ─────────────────────────────────────────────────────
    getInfraAlbDetail(accountId: string, region: string, albArn: string): Observable<AlbDetailPayload> {
        const params = new HttpParams()
            .set('accountId', accountId)
            .set('region', region)
            .set('albArn', albArn);
        return this.http.get<AlbDetailPayload>(`${this.apiBase}observability/infra-alb-detail`, { params });
    }

    // ── User infra ECS detail ─────────────────────────────────────────────────────
    getInfraEcsDetail(accountId: string, region: string, clusterArn: string): Observable<EcsDetailPayload> {
        const params = new HttpParams()
            .set('accountId', accountId)
            .set('region', region)
            .set('clusterArn', clusterArn);
        return this.http.get<EcsDetailPayload>(`${this.apiBase}observability/infra-ecs-detail`, { params });
    }


}
