import { Component, OnInit } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { AuthServiceService } from '../services/auth-service.service';

@Component({
    selector: 'app-confirm',
    templateUrl: './confirm.component.html',
    styleUrls: ['./confirm.component.css']
})
export class ConfirmComponent implements OnInit {

    username = '';
    confirmationCode = '';
    error = '';
    success = '';
    loading = false;

    constructor(
        private authService: AuthServiceService,
        private router: Router,
        private route: ActivatedRoute
    ) { }

    ngOnInit(): void {
        // Pre-fill username if passed as query param from signup page
        this.route.queryParams.subscribe(params => {
            if (params['username']) {
                this.username = params['username'];
            }
        });
    }

    confirm() {
        this.error = '';
        this.success = '';

        if (!this.username || !this.confirmationCode) {
            this.error = 'Please enter both your username and confirmation code.';
            return;
        }

        this.loading = true;

        this.authService.signUpConfirm(this.username, this.confirmationCode)
            .subscribe({
                next: () => {
                    this.success = 'Account confirmed! Redirecting to login...';
                    setTimeout(() => {
                        this.router.navigate(['/login'], {
                            queryParams: { usernamelogin: this.username }
                        });
                    }, 2000);
                },
                error: (err) => {
                    this.error = err?.error?.message || 'Invalid or expired code. Please try again.';
                    this.loading = false;
                }
            });
    }

    resendCode() {
        this.error = '';
        if (!this.username) {
            this.error = 'Please enter your username first.';
            return;
        }
        this.authService.resendConfirmationCode(this.username).subscribe({
            next: () => this.success = 'Code resent! Check your email.',
            error: () => this.error = 'Failed to resend code. Please try again.'
        });
    }
}