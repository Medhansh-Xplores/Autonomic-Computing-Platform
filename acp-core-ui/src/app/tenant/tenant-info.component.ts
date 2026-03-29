import { Component, OnInit } from '@angular/core';
import { AuthServiceService } from '../services/auth-service.service';
import { Router, RouterModule, ActivatedRoute } from '@angular/router';
import { first } from 'rxjs/operators';
import { IUser } from '../models/user.model';
import { HttpClient } from '@angular/common/http';
import { EnvService } from 'src/environments/env.service';

@Component({
  selector: 'tenant-info',
  templateUrl: './tenant-info.component.html',
  styleUrls: ['./tenant-info.component.css']
})
export class TenantInfoComponent implements OnInit {

  // HARDCODED API BASE
  apiBase = this.envService.apiUrl;
  // HARDCODED LICENSE 27b534a1-bbd1-4ae9-b3ce-37b41414d3af FOR NOW
  licenseNum = "27b534a1-bbd1-4ae9-b3ce-37b41414d3af";
  

  returnUrl!: string;
  error!: string;
  curUser: IUser | undefined;
  userName!: string;
  licenseType!: string;
  billingContactName!: string;
  billingContactEmail!: string;
  billingContactPhone!: string;
  technicalContactName!: string;
  technicalContactEmail!: string;
  technicalContactPhone!: string;
  creditCardDetails!: string;
  altEmail!: string;
  billingCycle!: string;
  
  

  constructor(private router: Router,
    private route: ActivatedRoute,
    private authService: AuthServiceService,
    private http: HttpClient,
    private envService: EnvService
  ) {
    if (this.authService.currentUserValue) {
      this.curUser = this.authService.currentUserValue;
      this.router.navigate(['']);
    }
  }

  ngOnInit() {

    // get return url from route parameters or default to '/'
    this.returnUrl = this.route.snapshot.queryParams['returnUrl'] || '/services';

    //CALL FOR NAME INFO
    this.http.get<any>(this.apiBase + this.licenseNum).subscribe(data => {
        this.userName = data.tenantName;
    })    
    //CALL FOR LICENSE TYPE
    this.http.get<any>(this.apiBase + this.licenseNum + "/license").subscribe(data => {
      this.licenseType = data.licenseType;
    })   
    //CALL FOR CONTACTS
    this.http.get<any>(this.apiBase + this.licenseNum + "/contacts").subscribe(data => {
      this.billingContactName = data.billingContactName;
      this.billingContactEmail = data.billingContactEmailAddress;
      this.billingContactPhone = data.billingContactPhoneNumber;
      this.technicalContactName = data.technicalContactName;
      this.technicalContactEmail = data.technicalContactEmailAddress;
      this.technicalContactPhone = data.technicalContactPhoneNumber;
    })  
    //CALL FOR BILLING
    this.http.get<any>(this.apiBase + this.licenseNum + "/billing").subscribe(data => {
      this.billingCycle = data.billingCycleType;
      this.altEmail = data.alternativeEmailAddress;
    })  

    // Can't find API for card info yet, OTHER INFO NEED API INFO (such as IaC, CI/CD, else)
    this.creditCardDetails = "John Smith xxx-1234 - AMEX (10/22/2022)";
  }

  valueChange(e:any, toChange: any) {
    if (toChange == 0){
      this.billingContactName = e.target.value;
    }
    else if (toChange == 1){
      this.billingContactEmail = e.target.value;
    }
    else if (toChange == 2){
      this.billingContactPhone = e.target.value;
    }
    else if (toChange == 3){
      this.technicalContactName = e.target.value;
    }
    else if (toChange == 4){
      this.technicalContactEmail = e.target.value;
    }
    else if (toChange == 5){
      this.technicalContactPhone = e.target.value;
    }
  }

  putEventLicense(e: any) {
    console.log("PREVIOUS VALUE: " + this.licenseType);
    const body = { licenseType: e.target.value};
    this.http.put<any>(this.apiBase + this.licenseNum + "/license", body)
          .subscribe(data => this.licenseType = data.licenseType);
  }

  putEventBillingCycle(e: any) {
    console.log("PREVIOUS VALUE: " + this.billingCycle);
    const body = { billingCycleType: e.target.value};
    this.http.put<any>(this.apiBase + this.licenseNum + "/billing", body)
          .subscribe(data => this.billingCycle = data.billingCycleType);
  }

  putEventContacts() {
    const body = { "billingContactName": this.billingContactName,
                  "billingContactEmailAddress": this.billingContactEmail,
                  "billingContactPhoneNumber": this.billingContactPhone,
                  "technicalContactName": this.technicalContactName,
                  "technicalContactEmailAddress": this.technicalContactEmail,
                  "technicalContactPhoneNumber": this.technicalContactPhone};
    this.http.put<any>(this.apiBase + this.licenseNum + "/contacts", body).subscribe(data => {
            this.billingContactName = data.billingContactName;
            this.technicalContactName = data.technicalContactName;
            this.billingContactEmail = data.billingContactEmailAddress;
            this.technicalContactEmail = data.technicalContactEmailAddress;
            this.billingContactPhone = data.billingContactPhoneNumber;
            this.technicalContactPhone = data.technicalContactPhoneNumber;
          });
  }

}

