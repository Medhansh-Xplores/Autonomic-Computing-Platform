import { Component, OnInit } from '@angular/core';
import { AuthServiceService } from '../services/auth-service.service';
import { Router, ActivatedRoute } from '@angular/router';
import { first } from 'rxjs/operators';
import { IUser } from '../models/user.model';
import { CloudAccountService } from '../services/cloud-account.service';  // ← ADD

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css']
})
export class LoginComponent implements OnInit {

  returnUrl!: string;
  error!: string;
  username!: string;
  password!: string;
  newuserConfirmationMsg!: string;
  usernamelogin!: string;
  loggingIn!: boolean;
  curUser: IUser | undefined;

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private authService: AuthServiceService,
    private cloudAccountService: CloudAccountService,  // ← ADD
  ) {
    if (this.authService.currentUserValue) {
      this.curUser = this.authService.currentUserValue;
      this.router.navigate(['']);
    }
  }

  ngOnInit() {
    this.returnUrl = this.route.snapshot.queryParams['returnUrl'] || '/services';

    this.route.queryParams.subscribe(params => {
      if (params['usernamelogin']) {
        this.newuserConfirmationMsg = params['usernamelogin'] + ' has been registered successfully, please sign in!';
      }
    });
  }

  loginUser() {
    this.loggingIn = true;
    const uName = this.username.toLowerCase();

    this.authService.login(uName, this.password)
      .pipe(first())
      .subscribe(
        resp => {
          this.loggingIn = false;

          if (resp.status == 202) {
            this.router.navigate(['/confirm'], { queryParams: { username: this.username } });
            return;
          }

          // ← CHECK if user has cloud accounts set up
          this.cloudAccountService.getAccounts().subscribe({
            next: (accounts) => {
              if (accounts.length === 0) {
                // First time user — redirect to cloud setup
                this.router.navigate(['/cloud-setup'], { state: { firstSetup: true } });
              } else {
                // Returning user — go to normal destination
                this.router.navigate([this.returnUrl]);
              }
            },
            error: () => {
              // If the check fails, just go home normally
              this.router.navigate([this.returnUrl]);
            }
          });
        },
        error => {
          this.loggingIn = false;
          const msg = error?.error?.message || '';
          if (
            msg.toLowerCase().includes('not confirmed') ||
            msg.toLowerCase().includes('usernotconfirmed')
          ) {
            this.error = 'Please confirm your email first.';
            this.router.navigate(['/confirm'], { queryParams: { username: this.username } });
          } else {
            this.error = 'Invalid Username or Password';
          }
        }
      );
  }
}
