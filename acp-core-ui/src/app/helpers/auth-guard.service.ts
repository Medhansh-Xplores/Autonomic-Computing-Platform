import { Injectable } from '@angular/core';
import { AuthServiceService } from '../services/auth-service.service';
import { Router, CanActivate, ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';

@Injectable({
  providedIn: 'root'
})
export class AuthGuardService implements CanActivate {

  constructor(
              private router: Router,
              private authService: AuthServiceService,
  ) { }

  canActivate(route: ActivatedRouteSnapshot, state: RouterStateSnapshot) {
    const currentUser = this.authService.currentUserValue;
    if (currentUser){
      //logged in so return true
      return true;
    }

    //not logged in, redirect to login page.
    // // console.log('redirecting to login');
    this.router.navigate(['login'], { queryParams: { returnUrl: state.url } });
    return false;
  }
}
