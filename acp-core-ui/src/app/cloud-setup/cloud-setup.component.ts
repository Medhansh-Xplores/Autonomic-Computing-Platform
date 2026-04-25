import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { CloudAccountService, CloudAccount } from '../services/cloud-account.service';

@Component({
    selector: 'app-cloud-setup',
    templateUrl: './cloud-setup.component.html',
    styleUrls: ['./cloud-setup.component.css']
})
export class CloudSetupComponent implements OnInit {

    accounts: CloudAccount[] = [];
    showForm = false;
    editingId: number | null = null;
    loading = false;
    error = '';
    success = '';
    verifyStatus: 'idle' | 'verifying' | 'ok' | 'error' = 'idle';
    verifyMessage = '';
    isFirstSetup = false;
    pendingExternalId: string = '';

    form: CloudAccount = {
        accountId: '',
        accountName: '',
        region: 'us-east-1',
        roleArn: '',
        isDefault: true,
        provider: 'AWS'
    };

    awsRegions = [
        { code: 'us-east-1', name: 'US East (N. Virginia)' },
        { code: 'us-east-2', name: 'US East (Ohio)' },
        { code: 'us-west-1', name: 'US West (N. California)' },
        { code: 'us-west-2', name: 'US West (Oregon)' },
        { code: 'ap-south-1', name: 'Asia Pacific (Mumbai)' },
        { code: 'ap-southeast-1', name: 'Asia Pacific (Singapore)' },
        { code: 'ap-southeast-2', name: 'Asia Pacific (Sydney)' },
        { code: 'ap-northeast-1', name: 'Asia Pacific (Tokyo)' },
        { code: 'eu-west-1', name: 'Europe (Ireland)' },
        { code: 'eu-west-2', name: 'Europe (London)' },
        { code: 'eu-central-1', name: 'Europe (Frankfurt)' },
        { code: 'ca-central-1', name: 'Canada (Central)' },
        { code: 'sa-east-1', name: 'South America (São Paulo)' },
    ];

    constructor(
        private cloudService: CloudAccountService,
        private router: Router
    ) { }

    ngOnInit() {
        this.isFirstSetup = history.state?.firstSetup === true;
        this.loadAccounts();
    }

    loadAccounts() {
        this.cloudService.getAccounts().subscribe({
            next: (data) => {
                this.accounts = data;
                // First time user — show form immediately
                if (data.length === 0) {
                    this.isFirstSetup = true;
                    this.cloudService.getNewExternalId().subscribe({
                        next: (res) => {
                            this.pendingExternalId = res.externalId;
                            this.showForm = true;
                        },
                        error: () => {
                            this.error = 'Could not generate External ID. Try again.';
                        }
                    });
                }
            },
            error: () => this.error = 'Failed to load accounts.'
        });
    }

    verify(id: number) {
        this.verifyStatus = 'verifying';
        this.cloudService.verifyConnection(id).subscribe({
            next: (res) => {
                this.verifyStatus = res.verified ? 'ok' : 'error';
                this.verifyMessage = res.message;
            },
            error: (err) => {
                this.verifyStatus = 'error';
                this.verifyMessage = err?.error?.message || 'Verification failed';
            }
        });
    }

    resetForm() {
        this.form = { accountId: '', accountName: '', region: 'us-east-1', roleArn: '', isDefault: false, provider: 'AWS' };
        this.editingId = null;
        this.error = '';
        this.success = '';
        this.pendingExternalId = '';
    }

    openAdd() {
        this.resetForm();
        this.form.isDefault = this.accounts.length === 0;
        this.cloudService.getNewExternalId().subscribe({
            next: (res) => {
                this.pendingExternalId = res.externalId;
                this.showForm = true;
            },
            error: () => {
                this.error = 'Could not generate External ID. Try again.';
            }
        });
    }

    openEdit(account: CloudAccount) {
        this.editingId = account.id!;
        this.form = { ...account };
        this.showForm = true;
        this.error = '';
        this.success = '';
    }

    copied = false;

    copyExternalId() {
        const el = document.createElement('textarea');
        el.value = this.pendingExternalId;
        document.body.appendChild(el);
        el.select();
        document.execCommand('copy');
        document.body.removeChild(el);

        this.copied = true;
        setTimeout(() => this.copied = false, 2000); // resets after 2s
    }

    copiedPolicy = false;

    getTrustPolicy(): string {
        return JSON.stringify({
            Version: "2012-10-17",
            Statement: [
                {
                    Effect: "Allow",
                    Principal: {
                        AWS: "arn:aws:iam::377122171982"  // replace with your actual AWS account ID
                    },
                    Action: "sts:AssumeRole",
                    Condition: {
                        StringEquals: {
                            "sts:ExternalId": this.pendingExternalId
                        }
                    }
                }
            ]
        }, null, 2);
    }

    copyTrustPolicy() {
        const el = document.createElement('textarea');
        el.value = this.getTrustPolicy();
        document.body.appendChild(el);
        el.select();
        document.execCommand('copy');
        document.body.removeChild(el);
        this.copiedPolicy = true;
        setTimeout(() => this.copiedPolicy = false, 2000);
    }

    save() {
        this.error = '';
        if (!this.form.accountId || !this.form.accountName || !this.form.region || !this.form.roleArn) {
            this.error = 'Account ID, Name, Region, and Role ARN are required.';
            return;
        }
        // Validate AWS Account ID format (12 digits)
        if (!/^\d{12}$/.test(this.form.accountId)) {
            this.error = 'AWS Account ID must be exactly 12 digits.';
            return;
        }

        this.loading = true;
        const payload = {
            ...this.form,
            externalId: this.pendingExternalId
        };

        const request = this.editingId
            ? this.cloudService.updateAccount(this.editingId, this.form)
            : this.cloudService.addAccount(payload);

        request.subscribe({
            next: () => {
                this.loading = false;
                this.success = this.editingId ? 'Account updated!' : 'Account added!';
                this.showForm = false;
                this.loadAccounts();

                // If first setup, redirect to home after saving
                if (this.isFirstSetup) {
                    setTimeout(() => this.router.navigate(['/services']), 1000);
                }
            },
            error: (err) => {
                this.loading = false;
                this.error = err?.error?.message || 'Failed to save account.';
            }
        });
    }

    delete(id: number) {
        if (!confirm('Delete this cloud account?')) return;
        this.cloudService.deleteAccount(id).subscribe({
            next: () => this.loadAccounts(),
            error: () => this.error = 'Failed to delete account.'
        });
    }

    setDefault(id: number) {
        this.cloudService.setDefault(id).subscribe({
            next: () => this.loadAccounts(),
            error: () => this.error = 'Failed to set default.'
        });
    }

    skip() {
        this.router.navigate(['/services']);
    }
}