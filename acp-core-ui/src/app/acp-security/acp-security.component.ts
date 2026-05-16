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
        const circumference = 2 * Math.PI * 42; // r=42
        return circumference - (score / 100) * circumference;
    }

    get circumference(): number {
        return 2 * Math.PI * 42;
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

    /**
     * Derives a short topic/subject from the check label.
     * e.g. "Privileged mode disabled" → "Privileged Mode"
     */
    checkTopic(label: string): string {
        const topicMap: Record<string, string> = {
            'Privileged mode disabled': 'Privileged Mode',
            'Read-only root filesystem': 'Root Filesystem',
            'Non-root container user': 'Container User',
            'Log driver configured': 'Log Driver',
            'No plain-text secrets in env vars': 'Secrets in Env Vars',
            'Role recently used (active)': 'IAM Role Activity',
            'No wildcard resource (*) permissions': 'IAM Wildcard Permissions',
            'No inbound 0.0.0.0/0 rules': 'Public Inbound Rules',
            'HTTPS listener enforced': 'HTTPS Listener',
            'HTTP → HTTPS redirect': 'HTTP Redirect',
            'Modern TLS policy (TLS 1.3)': 'TLS Policy',
            'WAF ACL attached': 'WAF Protection',
            'Access logs enabled': 'Access Logs',
            'RDS not publicly accessible': 'RDS Public Access',
            'Storage encrypted at rest': 'Storage Encryption',
            'Deletion protection enabled': 'Deletion Protection',
            'Backup retention ≥ 7 days': 'Backup Retention',
            'GuardDuty detector enabled': 'GuardDuty Detector',
            'No HIGH severity findings': 'High-Severity Findings',
            'CloudTrail trail active': 'CloudTrail Trail',
            'Multi-region trail': 'Multi-Region Logging',
            'Log file integrity validation': 'Log Integrity Validation',
            'Delivery to CloudWatch Logs': 'CloudWatch Delivery',
            'Certificate valid > 30 days': 'Certificate Validity',
            'Auto-renewal configured': 'Auto-Renewal',
        };
        return topicMap[label] ?? label;
    }

    /**
     * Returns a clear, plain-English result phrase so users know
     * exactly what was found — not just pass/fail.
     * e.g. label="Privileged mode disabled", status="pass" → "Running unprivileged ✓ (secure)"
     */
    checkFinding(label: string, status: CheckStatus): string {
        const findingMap: Record<string, { pass: string; fail: string; warn?: string }> = {
            'Privileged mode disabled': {
                pass: 'Container runs unprivileged — no host access',
                fail: 'Container is running in privileged mode — host exposed',
                warn: 'Privileged mode status unclear'
            },
            'Read-only root filesystem': {
                pass: 'Filesystem is read-only — writes blocked at root',
                fail: 'Root filesystem is writable — tampering risk',
            },
            'Non-root container user': {
                pass: 'Process runs as a non-root user',
                fail: 'Process runs as root inside the container',
            },
            'Log driver configured': {
                pass: 'Log driver is set — logs are being collected',
                fail: 'No log driver configured — logs may be lost',
            },
            'No plain-text secrets in env vars': {
                pass: 'No raw secrets found in environment variables',
                fail: 'Plain-text secrets detected in env vars — rotate immediately',
            },
            'Role recently used (active)': {
                pass: 'Role was used within the last 30 days',
                warn: 'Role has not been used recently — verify it\'s still needed',
                fail: 'Role usage could not be confirmed',
            },
            'No wildcard resource (*) permissions': {
                pass: 'Permissions are scoped — no wildcard (*) resources',
                fail: 'Wildcard (*) resource permissions found — over-permissioned',
            },
            'No inbound 0.0.0.0/0 rules': {
                pass: 'No rules open to the public internet (0.0.0.0/0)',
                fail: 'Inbound rules open to 0.0.0.0/0 — publicly exposed',
            },
            'HTTPS listener enforced': {
                pass: 'ALB has an HTTPS listener on port 443',
                fail: 'No HTTPS listener found — traffic may be unencrypted',
            },
            'HTTP → HTTPS redirect': {
                pass: 'HTTP requests are redirected to HTTPS automatically',
                fail: 'HTTP traffic is not being redirected — insecure access possible',
            },
            'Modern TLS policy (TLS 1.3)': {
                pass: 'TLS 1.3 policy in use — strong encryption enforced',
                fail: 'Outdated TLS policy — vulnerable to downgrade attacks',
                warn: 'TLS policy may not support TLS 1.3 — review recommended',
            },
            'WAF ACL attached': {
                pass: 'WAF ACL is attached and filtering requests',
                fail: 'No WAF ACL attached — ALB is unprotected',
            },
            'Access logs enabled': {
                pass: 'ALB access logs are enabled — requests are recorded',
                fail: 'Access logging is off — no request audit trail',
            },
            'RDS not publicly accessible': {
                pass: 'RDS instance is not publicly accessible',
                fail: 'RDS instance is publicly accessible — exposed to internet',
            },
            'Storage encrypted at rest': {
                pass: 'RDS storage is encrypted at rest',
                fail: 'RDS storage is NOT encrypted — data at risk',
            },
            'Deletion protection enabled': {
                pass: 'Deletion protection is on — accidental drops prevented',
                fail: 'Deletion protection is off — database can be dropped',
            },
            'Backup retention ≥ 7 days': {
                pass: 'Backup retention meets the 7-day minimum',
                fail: 'Backup retention is below 7 days — recovery window too short',
            },
            'GuardDuty detector enabled': {
                pass: 'GuardDuty detector is active and monitoring',
                fail: 'GuardDuty detector is not enabled — threats undetected',
            },
            'No HIGH severity findings': {
                pass: 'No high-severity threats detected in the last 7 days',
                fail: 'High-severity GuardDuty findings detected — investigate immediately',
            },
            'CloudTrail trail active': {
                pass: 'CloudTrail trail is active — API activity is logged',
                fail: 'CloudTrail trail is inactive — no API audit logging',
            },
            'Multi-region trail': {
                pass: 'Trail covers all regions — full audit coverage',
                fail: 'Trail is single-region only — activity in other regions not logged',
            },
            'Log file integrity validation': {
                pass: 'Log files are integrity-validated — tampering detectable',
                fail: 'Log integrity validation is off — logs could be altered',
            },
            'Delivery to CloudWatch Logs': {
                pass: 'CloudTrail is delivering logs to CloudWatch',
                fail: 'CloudTrail is not sending logs to CloudWatch — alerts unavailable',
            },
            'Certificate valid > 30 days': {
                pass: 'Certificate is valid and has more than 30 days remaining',
                fail: 'Certificate expires within 30 days — renew immediately',
                warn: 'Certificate expiry is approaching — schedule renewal',
            },
            'Auto-renewal configured': {
                pass: 'ACM auto-renewal is configured — no manual action needed',
                fail: 'Auto-renewal is not configured — certificate may expire',
            },
        };
        const entry = findingMap[label];
        if (!entry) return label;
        if (status === 'pass') return entry.pass;
        if (status === 'fail') return entry.fail;
        return entry.warn ?? entry.fail;
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
