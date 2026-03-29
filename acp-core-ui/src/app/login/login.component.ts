import { Component, OnInit } from '@angular/core';
import { AuthServiceService } from '../services/auth-service.service';
import { Router, RouterModule, ActivatedRoute } from '@angular/router';
import { first } from 'rxjs/operators';
import { IUser } from '../models/user.model';

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
  curUser : IUser | undefined;

  constructor(private router: Router,
              private route: ActivatedRoute,
              private authService: AuthServiceService, 
             ) { 

               if (this.authService.currentUserValue){
                  this.curUser = this.authService.currentUserValue;
                  this.router.navigate(['']);
               }
             }

             ngOnInit() {

               // get return url from route parameters or default to '/'
               this.returnUrl = this.route.snapshot.queryParams['returnUrl'] || '/services';

               this.route.queryParams.subscribe(params => {
                 // // console.log(JSON.stringify(params.usernamelogin));
                 // this.usernamelogin = params.get ('usernamelogin');

                 if (params['usernamelogin'])
                   {
                     this.newuserConfirmationMsg=params['usernamelogin'] + ' has been registered successfully, please sign in!'; // popular4
                   }

               });
             }

             loginUser(){
              this.loggingIn = true;
               // // console.log('logging in! username: '+this.username+' password: '+this.password);
               //this.authService.announceUserAuth(true);
               const uName = this.username.toLowerCase();
               this.authService.login(uName, this.password)
               .pipe(first())
               .subscribe(
                 resp => {
                   // // console.log(resp);
                   if(resp.status == 202)
                     {
                       // // console.log('First time user: Redirect to Confirm/Change password page')
                       this.router.navigate(['/confirm']);
                     }
                     else
                       {
                         this.router.navigate([this.returnUrl]);
                       }
                       
                 },
                       error => {
                         this.error = "Invalid Username or Password";
                         // // console.log('loging error');
                         // // console.log(this.error);
                         //this.loading = false;
                         this.loggingIn = false;
                       });

             
             //this.router.navigateByUrl('');
}

}

