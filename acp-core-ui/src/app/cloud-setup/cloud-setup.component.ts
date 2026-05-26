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
    verifyingId: number | null = null;
    verifyMessage = '';
    isFirstSetup = false;
    pendingExternalId: string = '';
    selectedCloud: string = 'aws';
    authType: 'role' | 'keys' | 'secret' = 'role';

    form: any = {
        accountId: '',
        accountName: '',
        region: 'us-east-1',
        roleArn: '',
        accessKeyId: '',
        secretAccessKey: '',
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

    azureRegions = [
        { code: 'eastus', name: 'East US' },
        { code: 'eastus2', name: 'East US 2' },
        { code: 'westus', name: 'West US' },
        { code: 'westus2', name: 'West US 2' },
        { code: 'centralus', name: 'Central US' },
        { code: 'northeurope', name: 'North Europe' },
        { code: 'westeurope', name: 'West Europe' },
        { code: 'southeastasia', name: 'Southeast Asia' },
    ];

    selectCloud(cloud: 'aws' | 'azure') {
        this.selectedCloud = cloud;
        if (cloud === 'aws') {
            this.form.provider = 'AWS';
            this.form.region = 'us-east-1';
            this.authType = 'role';
            if (!this.pendingExternalId) {
                this.cloudService.getNewExternalId().subscribe({
                    next: (res) => this.pendingExternalId = res.externalId
                });
            }
        } else {
            this.form.provider = 'Azure';
            this.form.region = 'eastus';
            this.authType = 'secret';
            this.pendingExternalId = '';
        }
        this.error = '';
        this.success = '';
    }

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
        this.verifyingId = id;
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
        this.selectedCloud = 'aws';
        this.form = {
            accountId: '',
            accountName: '',
            region: 'us-east-1',
            roleArn: '',
            accessKeyId: '',
            secretAccessKey: '',
            isDefault: false,
            provider: 'AWS'
        };
        this.authType = 'role';
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
        this.selectedCloud = account.provider?.toLowerCase() === 'azure' ? 'azure' : 'aws';
        if (this.selectedCloud === 'azure') {
            this.authType = 'secret';
            this.pendingExternalId = account.externalId || '';
        } else {
            this.authType = account.roleArn ? 'role' : 'keys';
        }
        this.showForm = true;
        this.error = '';
        this.success = '';
    }

    copied = false;
    copiedRoleName = false;

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

    copyRoleName() {
        this.copyToClipboard('ACPDeploymentRole');
    }

    copyAccountId() {
        this.copyToClipboard('377122171982');
    }

    private copyToClipboard(text: string): void {
        if (navigator.clipboard && navigator.clipboard.writeText) {
            // HTTPS — use modern clipboard API
            navigator.clipboard.writeText(text).catch(err => {
                console.error('Clipboard write failed:', err);
            });
        } else {
            // HTTP fallback — use deprecated execCommand
            const textarea = document.createElement('textarea');
            textarea.value = text;
            textarea.style.position = 'fixed';
            textarea.style.opacity = '0';
            document.body.appendChild(textarea);
            textarea.focus();
            textarea.select();
            document.execCommand('copy');
            document.body.removeChild(textarea);
        }
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

        this.form.provider = this.selectedCloud === 'aws' ? 'AWS' : 'Azure';

        // ✅ Common validation
        if (!this.form.accountId || !this.form.accountName || !this.form.region) {
            const idLabel = this.selectedCloud === 'aws' ? 'Account ID' : 'Subscription ID';
            this.error = `${idLabel}, Name, and Region are required.`;
            return;
        }

        // ✅ AWS validation
        if (this.selectedCloud === 'aws') {
            if (this.authType === 'role' && !this.form.roleArn) {
                this.error = 'Role ARN is required.';
                return;
            }

            if (this.authType === 'keys' && (!this.form.accessKeyId || !this.form.secretAccessKey)) {
                this.error = 'Access Key ID and Secret Access Key are required.';
                return;
            }

            // ✅ Validate AWS Account ID format (12 digits)
            if (!/^\d{12}$/.test(this.form.accountId)) {
                this.error = 'AWS Account ID must be exactly 12 digits.';
                return;
            }

            // ✅ Clean unused fields
            if (this.authType === 'role') {
                this.form.accessKeyId = '';
                this.form.secretAccessKey = '';
            } else {
                this.form.roleArn = '';
            }
        }

        // ✅ Azure validation
        if (this.selectedCloud === 'azure') {
            if (this.authType === 'secret') {
                if (!this.form.roleArn || !this.pendingExternalId || !this.form.secretAccessKey) {
                    this.error = 'Tenant ID, Client ID, and Client Secret are required.';
                    return;
                }
            }
            // Validate Subscription ID format (UUID)
            const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
            if (!uuidRegex.test(this.form.accountId)) {
                this.error = 'Azure Subscription ID must be a valid UUID (e.g. 12345678-xxxx-xxxx-xxxx-xxxxxxxxxxxx).';
                return;
            }
        }

        this.loading = true;

        // ✅ Payload (include authType)
        const payload = {
            ...this.form,
            externalId: this.pendingExternalId,
            authType: this.authType
        };

        // ✅ Use payload for BOTH add & update
        const request = this.editingId
            ? this.cloudService.updateAccount(this.editingId, payload)
            : this.cloudService.addAccount(payload);

        request.subscribe({
            next: () => {
                this.loading = false;
                this.success = this.editingId ? 'Account updated!' : 'Account added!';
                this.showForm = false;
                this.loadAccounts();

                // First-time user redirect
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