import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { IUser, IForgot } from '../models/user.model';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class AuthServiceService {

  emptyUser!: IUser;
  authUrl = environment.apiUrl + '/auth';

  private currentUserSubject: BehaviorSubject<IUser>;
  public currentUser: Observable<IUser>;

  constructor(private http: HttpClient) {
    this.currentUserSubject = new BehaviorSubject<IUser>(
      JSON.parse(localStorage.getItem('currentUser')!)
    );
    this.currentUser = this.currentUserSubject.asObservable();
  }

  public get currentUserValue(): IUser {
    return this.currentUserSubject.value;
  }

  // NEW: returns just the token string for the HTTP interceptor
  public getToken(): string | null {
    const user = this.currentUserSubject.value;
    return user ? user.cognitoSession ?? null : null;
  }

  // auth-service.service.ts
  login(username: string, password: string) {
    const payload = { userName: username, userPassword: password };
    return this.http.post<any>(this.authUrl + '/authenticate', payload, { observe: 'response' })
      .pipe(map(response => {
        const user = response.body;
        localStorage.setItem('currentUser', JSON.stringify(user));
        this.currentUserSubject.next(user);
        return response; // return full response so login component can check .status
      }));
  }

  resendConfirmationCode(username: string) {
    return this.http.post<any>(this.authUrl + '/resendCode', { username });
  }

  logOut() {
    localStorage.removeItem('currentUser');
    this.currentUserSubject.next(this.emptyUser);
  }

  beginResetPassword(user: string): Observable<IForgot> {
    return this.http.post<IForgot>(this.authUrl + '/forgotPassword/' + user, { observe: 'response' });
  }

  finishResetPassword(user: string, code: string, newpass: string): Observable<IForgot> {
    return this.http.post<IForgot>(this.authUrl + '/confirmPassword/' + user + '/' + code + '/' + newpass, { observe: 'response' });
  }

  signUp(firstname: string, lastname: string, email: string, username: string, password: string) {
    const payload = { firstname, lastname, email, username, password };
    return this.http.post<any>(this.authUrl + '/signUp', payload)
      .pipe(map(resp => resp));
  }

  signUpConfirm(username: string, confirmationcode: string) {
    const payload = { username, confirmationcode };
    return this.http.post<any>(this.authUrl + '/signUpConfirm', payload)
      .pipe(map(resp => resp));
  }
}