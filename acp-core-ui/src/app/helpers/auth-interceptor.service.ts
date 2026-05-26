import { Injectable } from '@angular/core';
import {
    HttpRequest,
    HttpHandler,
    HttpEvent,
    HttpInterceptor,
    HttpErrorResponse
} from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { Router } from '@angular/router';
import { AuthServiceService } from '../services/auth-service.service';

@Injectable()
export class AuthInterceptorService implements HttpInterceptor {

    constructor(private authService: AuthServiceService, private router: Router) { }

    intercept(request: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {

        const token = this.authService.getToken();

        // If we have a token, clone the request and attach it
        if (token) {
            request = request.clone({
                setHeaders: {
                    Authorization: `Bearer ${token}`
                }
            });
        }

        // Also handle 401 errors — if backend says "not authorized", log out
        return next.handle(request).pipe(
            catchError((error: HttpErrorResponse) => {
                if (error.status === 401) {
                    this.authService.logOut();
                    this.router.navigate(['/login']);
                }
                return throwError(() => error);
            })
        );
    }
}