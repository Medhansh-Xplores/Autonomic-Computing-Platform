import { Component, OnInit } from '@angular/core';
import { Router} from '@angular/router';
import {HttpClient, HttpErrorResponse} from '@angular/common/http';
import { JenkinsService} from '../services/jenkins.service';
import { MyWebApp} from '../models/myWebApp.model';
import {Subscription} from 'rxjs';
import {IUser} from '../models/user.model';
import {AuthServiceService} from '../services/auth-service.service';
import { faQuestionCircle } from '@fortawesome/free-solid-svg-icons';

@Component({
  selector: 'app-create-application',
  templateUrl: './create-application.component.html',
  styleUrls: ['./create-application.component.css']
})
export class CreateApplicationComponent implements OnInit {
  faQuestionCircle = faQuestionCircle;
  authSub: Subscription | undefined;
  curUser: IUser | undefined;
  submissionInfo = '';
  payload: JSON | undefined;
  correctPlatform = false;
  correctAppType = false;
  correctAppName = false;
  correctAppPort = false;
  correctMemoryLimit = false;
  correctendPoint = false;
  correctimage = false;
  hasErrors = false;
  submitDisabled = false;
  webApp: MyWebApp = new MyWebApp();

  obj: any = {'parameter': [
      {'appType': ''},
      {'appName': ''},
      {'appPort': ''},
      {'memoryLimit': ''},
      {'healthCheckUrl': ''},
      {'imageTag': ''},
  ]};
  types = ['',
    'MicroService',
  'WebApp',
  'NodeJS',
  'Rails',
  'Go'];
  typeSelected = this.types[0];

  platforms = [{'name': '', 'value': ''},
    {'name': 'AWS RedHat Openshift Container Platform', 'value': 'Openshift'},
    {'name': 'AWS Elastic Kubernetes Service (EKS)', 'value': 'EKS'},
    {'name': 'Google Cloud Kubernetes Engine (GKE)', 'value': 'GKE'},
    {'name': 'AWS - Cloud HPC (Coming Soon)', 'value': 'HPC'},
    {'name': 'IBM - Cloud HPC (Coming Soon)', 'value': 'HPC'},
    {'name': 'Azure - Cloud HPC (Coming Soon)', 'value': 'HPC'},
    {'name': 'IBM - Quantum Cloud (Coming Soon)', 'value': 'Quantum'},
    {'name': 'AWS - Quantum Cloud (Coming Soon)', 'value': 'Quantum'},
    ];
  platformSelected = this.platforms[0]['value'];
  constructor(private http: HttpClient, private router: Router, private jenkins: JenkinsService,
              private authService: AuthServiceService) { }

  ngOnInit() {
  }

  async helpMe(keyword: string) {
    // await this.helperBot.sendShow(true);
    //await this.helperBot.sendMessage(keyword, true);
  }

  selectType (event: any) {
    // // console.log('Application Type  is: ' + event.target.value);
    this.typeSelected = event.target.value;
    if (this.typeSelected === 'WebApp') {
      this.webApp.appType = 'SpringBoot-WebApp';
    } else {
      if (this.typeSelected === 'MicroService') {
        this.webApp.appType = 'SpringBoot-MicroService';
      } else {
        this.webApp.appType = this.typeSelected;
      }
    }
  }

  async selectPlatform (event1: any) {
    // // console.log('Operational Platform  is: ' + event1.target.value);
    this.platformSelected = event1.target.value;
    this.webApp.targetPlatform = this.platformSelected;
    this.authSub =  await this.authService.currentUser.subscribe(
      userAuth => {
        this.curUser = userAuth;
        // // console.log(this.curUser);
        this.webApp.user = this.curUser.userName;
      });
  }

  async submit() {
    if (this.platformSelected === 'HPC' ||
      this.platformSelected === 'Quantum'){
      alert('This service is not operational at this time.');
    } else {
      if (this.typeSelected.length !== 0) {
        this.correctAppType = true;
      }
      if (this.platformSelected.length !== 0) {
        this.correctPlatform = true;
      }
      if (this.webApp.appName) {
        if (this.webApp.appName.length !== 0 && !/[~`!#$%\^&*+=\-\[\]_ \\';,/{}|\\":<>\?]/g.test(this.webApp.appName)) {
          // if (this.firstNotNumber(this.webApp.appName[0]) === true) {
            this.correctAppName = true;
            this.webApp.appName = this.webApp.appName.toLowerCase();
          // } else {
          //  this.correctAppName = false;
          // }
        } else {
          this.correctAppName = false;
        }
      }
      if (this.webApp.appPort) {
        this.correctAppPort = this.webApp.appPort.length !== 0 && this.validateIsNumber(this.webApp.appPort) === true
          && this.validateIsPort(this.webApp.appPort) === true;
      }
      if (this.webApp.memoryLimit) {
        if (this.webApp.memoryLimit.length !== 0) {
          if (this.validateIsNumber(this.webApp.memoryLimit) === true) {
            this.webApp.memoryLimit = this.webApp.memoryLimit + 'Mi';
            this.correctMemoryLimit = true;
          }
        }
      }
      /* if (this.webApp.endPoint) {
        if (this.webApp.endPoint.length !== 0) {
          // // console.log(this.webApp.endPoint[0]);
          this.correctendPoint = this.firstCharisSlash(this.webApp.endPoint[0]) === true;
        } else {
          this.correctendPoint = false;
        }
      }*/
      if (this.webApp.image) {
        if (this.webApp.image.length !== 0) {
          this.correctimage = true;
        }
      }
       // console.log('appName: ' + this.correctAppName);
       // console.log('appType: ' + this.correctAppType);
       // console.log('appPort: ' + this.correctAppPort);
       // console.log('MemoryLimit: ' + this.correctMemoryLimit);
       // // console.log('endPoint: ' + this.correctendPoint);
       // console.log('image: ' + this.correctimage);
      if (this.correctAppName ===  true && this.correctAppPort ===  true && this.correctAppType ===  true &&
        this.correctMemoryLimit === true && this.correctimage === true) {
        //const paramstring = '?appType=' + this.typeSelected + '&appName=' + this.webApp.appName + '&appPort=' + this.webApp.appPort
        //  + '&memoryLimit=' + this.webApp.memoryLimit + '&endPoint=' + this.webApp.endPoint + '&user=' + this.webApp.user
        //  + '&image=' + this.webApp.image;
        this.webApp.endPoint = '/';
        this.hasErrors = false;
        const res = await this.jenkins.createWebApp(this.webApp);
        // console.log(res);
        // // console.log(res);
        if (res === '201' || res === 201) {
          //alert('this is really working');
          // // console.log('Starting Delay');
          this.submitDisabled = true;
          this.submissionInfo = 'Submitting Request';
          this.submitDisabled = true;
          await this.delay(3000);
          this.submissionInfo = 'Waiting For Acknowledgement of Start of Build';
          await this.delay(6000);
          this.submissionInfo = 'Redirecting to Infrastructure Information Page';
          await this.delay(1000);
          // // console.log('Ending Delay');
          this.router.navigateByUrl('/lastBuild');
        }
        // (err: HttpErrorResponse) => {
        //  // // console.log(err);
        //  // // console.log(this.payload);
        //  // // console.log('ERROR');
        //  window.scrollTo(0, 0);
        // }
        // );
      } else {
        // alert('To Do:  Finish Error Validations.');
        this.hasErrors = true;
      }
    }
  }

  private delay(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // validateDropdown is a function that checks to see if an item was first selected from the list (besides an empty string) and then makes
  // sure that the value is in fact included in the list provided.
  private validateDropdown(param: string, list: string | string[]) {
    if (param.length !== 0) {
      return list.indexOf(param) !== -1;
    } else {
      return false;
    }
  }

  // validateIsNumber is a function that check to see if the provided parameter is a number.
  private validateIsNumber(param: any) {
    return param.length !== 0 && isNaN(param) === false;
  }

  private validateIsPort(param: any) {
    return param.length !== 0 && isNaN(param) === false && param >= 1024 && param <= 49151;
  }

  // validateNoSpecialCharacters is a function that checks to see if the provided parameter has special characters in the string.
  public validateNoSpecialCharacters(param: any) {
    return param.length !== 0 && !/[~`!#$%\^&*+=\-\[\] \\';,/{}|\\":<>\?]/g.test(param);
  }

  public validateIsString(param: any) {
    return param.length !== 0;
  }

  private firstCharisSlash(param: any) {
    return param === '/';
  }

  private firstNotNumber(param: any) {
    return !this.validateIsNumber(param);
  }

  private firstNotUpper(param: any) {
    return param === param.toLowerCase();
  }

}
