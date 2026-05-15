import { Component, OnInit, OnDestroy } from '@angular/core';
import { Subscription } from 'rxjs';
import { ObservabilityService } from '../services/observability.service';
import {
    AcpSecurityPosture,
    SecurityCheck,
    CheckStatus,
    GuardDutyFinding,
    CertificateSecurity,
    SecretSecurity,
} from '../models/security.model';

const ACP_REGION = 'us-east-1';
const ACP_CLUSTER = 'acp-cluster';

export type SecuritySection = 'container' | 'network' | 'threat' | 'audit';

@Component({
    selector: 'app-acp-security',
    templateUrl: './acp-security.component.html',
    styleUrls: ['./acp-security.component.css'],
})
export class AcpSecurityComponent implements OnInit, OnDestroy {

    posture: AcpSecurityPosture | null = null;
    loading = true;
    error = '';
    activeSection: SecuritySection | null = null;

    private subs: Subscription[] = [];

    constructor(private observabilityService: ObservabilityService) { }

    ngOnInit(): void {
        this.subs.push(
            this.observabilityService.pollAcpSecurityPosture(ACP_REGION, ACP_CLUSTER).subscribe({
                next: d => { this.posture = d; this.loading = false; this.error = ''; },
                error: e => { this.loading = false; this.error = e?.error?.error || 'Failed to load security posture'; },
            })
        );
    }

    ngOnDestroy(): void {
        this.subs.forEach(s => s.unsubscribe());
    }

    toggleSection(section: SecuritySection): void {
        this.activeSection = this.activeSection === section ? null : section;
    }

    // ── Score helpers ─────────────────────────────────────────────────────────
    get scoreClass(): string {
        const s = this.posture?.overall?.status;
        if (s === 'healthy') return 'score-healthy';
        if (s === 'degraded') return 'score-degraded';
        if (s === 'unhealthy') return 'score-unhealthy';
        return 'score-unknown';
    }

    get scoreLabel(): string {
        const s = this.posture?.overall?.status;
        if (s === 'healthy') return 'Secure';
        if (s === 'degraded') return 'Needs Attention';
        if (s === 'unhealthy') return 'At Risk';
        return 'Unknown';
    }

    get scoreDashOffset(): number {
        const score = this.posture?.overall?.score ?? 0;
        const circumference = 2 * Math.PI * 36; // r=36
        return circumference - (score / 100) * circumference;
    }

    get circumference(): number {
        return 2 * Math.PI * 36;
    }

    // ── Section fail-count helpers (for card badges) ──────────────────────────
    countFails(checks: SecurityCheck[]): number {
        return (checks || []).filter(c => c.status === 'fail').length;
    }

    get containerFails(): number {
        return this.countFails([
            ...(this.posture?.taskDefinition?.checks || []),
            ...(this.posture?.iamRole?.checks || []),
            ...(this.posture?.secrets || []).map(s => ({ id: s.name, label: s.name, status: s.status })),
        ]);
    }

    get networkFails(): number {
        return this.countFails([
            ...(this.posture?.network?.securityGroups || []).flatMap(sg => sg.checks),
            ...(this.posture?.network?.alb?.checks || []),
            ...(this.posture?.network?.rds?.checks || []),
            this.posture?.network?.flowLogs?.status === 'fail'
                ? [{ id: 'flow', label: 'flow', status: 'fail' as CheckStatus }]
                : [],
        ].flat());
    }

    get threatFails(): number {
        return this.countFails(this.posture?.guardDuty?.checks || []);
    }

    get auditFails(): number {
        return this.countFails([
            ...(this.posture?.cloudTrail?.checks || []),
            ...(this.posture?.certificates || []).flatMap(c => c.checks),
        ]);
    }

    // ── Status helpers ────────────────────────────────────────────────────────
    checkClass(status: CheckStatus): string {
        if (status === 'pass') return 'check-pass';
        if (status === 'fail') return 'check-fail';
        return 'check-warn';
    }

    checkIcon(status: CheckStatus): string {
        if (status === 'pass') return '✓';
        if (status === 'fail') return '✗';
        return '⚠';
    }

    formatDate(d: string | null): string {
        if (!d) return '—';
        return new Date(d).toLocaleString();
    }

    expiryClass(days: number | null): string {
        if (days === null) return '';
        if (days <= 14) return 'expiry-critical';
        if (days <= 30) return 'expiry-warning';
        return 'expiry-ok';
    }

    severityClass(sev: string): string {
        return sev === 'HIGH' ? 'severity-high' : 'severity-medium';
    }

    secretRotationClass(secret: SecretSecurity): string {
        if (!secret.rotationEnabled) return 'check-fail';
        if (secret.lastRotatedDays !== null && secret.lastRotatedDays > 90) return 'check-warn';
        return 'check-pass';
    }
}
