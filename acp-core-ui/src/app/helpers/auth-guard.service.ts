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
    const token = this.authService.getToken();   // ADD this line

    if (currentUser && token) {                  // CHANGE: check token too
      return true;
    }

    this.authService.logOut();                   // ADD: clean up stale user object
    this.router.navigate(['login'], { queryParams: { returnUrl: state.url } });
    return false;
  }
}
