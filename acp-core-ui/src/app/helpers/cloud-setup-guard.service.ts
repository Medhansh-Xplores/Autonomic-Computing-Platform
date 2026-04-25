import { Injectable } from '@angular/core';
import { CanActivate, Router } from '@angular/router';
import { CloudAccountService } from '../services/cloud-account.service';
import { map, catchError } from 'rxjs/operators';
import { of } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class CloudSetupGuard implements CanActivate {

    constructor(private cloudService: CloudAccountService, private router: Router) { }

    canActivate() {
        return this.cloudService.getAccounts().pipe(
            map(accounts => {
                if (accounts.length === 0) {
                    this.router.navigate(['/cloud-setup'], { state: { firstSetup: true } });
                    return false;
                }
                return true;
            }),
            catchError(() => of(true)) // if check fails, let them through
        );
    }
}