import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { IUser, IForgot } from '../models/user.model';

@Injectable({
  providedIn: 'root'
})
export class AuthServiceService {

  // empty user
  emptyUser!: IUser; 

  authUrl = 'https://cognito.aceinfosolutions.com';

  private currentUserSubject : BehaviorSubject<IUser>;
  public currentUser : Observable<IUser>;


  constructor( private http: HttpClient ) {
    this.currentUserSubject = new BehaviorSubject<IUser>(JSON.parse(localStorage.getItem('currentUser')!));
    // this.currentUserSubject = new BehaviorSubject<IUser>(JSON.parse(""));
    this.currentUser = this.currentUserSubject.asObservable();
  }

  public get currentUserValue() : IUser {
    return this.currentUserSubject.value;
  }


  login(username: string, password: string) {
    const obj: any = {'userName': username, 'userPassword': password };
    const payload = <JSON>obj;
    return this.http.post<any>(this.authUrl + '/authenticate', payload)
    .pipe(map(user => {
      // store user details and jwt token in local storage to keep user logged in between page refreshes
      localStorage.setItem('currentUser', JSON.stringify(user));
      this.currentUserSubject.next(user);
      return user;
    }));
  }


  logOut() {
    localStorage.removeItem('currentUser');
    this.currentUserSubject.next(this.emptyUser);
  }



  beginResetPassword(user: string) : Observable<IForgot>{
    return this.http.post<IForgot>(this.authUrl + '/forgotPassword/' + user, { observe: 'response' });
  }

  finishResetPassword(user: string, code: string, newpass: string) : Observable<IForgot>{
    return this.http.post<IForgot>(this.authUrl + '/confirmPassword/' + user + '/' + code + '/' + newpass, { observe: 'response'});
  }


signUp(firstname: string, lastname:string, email: string,  username: string, password: string) {
  const obj: any = {'firstname': firstname, 'lastname': lastname, 'email':email,'username': username, 'password': password };
  const payloadreg = <JSON>obj;
  // // console.log (payloadreg);
  return this.http.post<any>(this.authUrl + '/signUp', payloadreg)
      .pipe(map(resp => {
          // store user details and jwt token in local storage to keep user logged in between page refreshes
          
          // // console.log ("response values" + resp);
        //  this.currentUserSubject.next(user);
          return resp;
      }));
}

signUpConfirm(username: string, confirmationcode: string) {
  const obj: any = {'username': username, 'confirmationcode': confirmationcode};
  const payloadreg = <JSON>obj;
  // // console.log (payloadreg);
  return this.http.post<any>(this.authUrl + '/signUpConfirm', payloadreg)
      .pipe(map(resp => {
          // store user details and jwt token in local storage to keep user logged in between page refreshes
      //    // // console.log (resp);
        //  this.currentUserSubject.next(user);
          return resp;
      }));
}


}
