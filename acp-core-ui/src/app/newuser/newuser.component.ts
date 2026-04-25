import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { AuthServiceService } from '../services/auth-service.service';

@Component({
    selector: 'app-newuser',
    templateUrl: './newuser.component.html',
    styleUrls: ['./newuser.component.css']
})
export class NewuserComponent {

    firstname = '';
    lastname = '';
    email = '';
    username = '';
    password = '';
    confirmPassword = '';
    error = '';
    loading = false;

    constructor(private authService: AuthServiceService, private router: Router) { }

    register() {
        this.error = '';

        if (this.password !== this.confirmPassword) {
            this.error = 'Passwords do not match.';
            return;
        }

        this.loading = true;
        this.authService.signUp(this.firstname, this.lastname, this.email, this.username, this.password)
            .subscribe({
                next: () => {
                    // Cognito sends a confirmation code to the email
                    this.loading = false;
                    this.router.navigate(['/confirm'], { queryParams: { username: this.username } });
                },
                error: (err) => {
                    this.error = err?.error?.message || 'Registration failed. Please try again.';
                    this.loading = false;
                }
            });
    }
}