import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { JenkinsService } from '../services/jenkins.service';
import { MyWebApp } from '../models/myWebApp.model';
import { Subscription } from 'rxjs';
import { IUser } from '../models/user.model';
import { AuthServiceService } from '../services/auth-service.service';
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

  obj: any = {
    'parameter': [
      { 'appType': '' },
      { 'appName': '' },
      { 'appPort': '' },
      { 'memoryLimit': '' },
      { 'healthCheckUrl': '' },
      { 'imageTag': '' },
    ]
  };
  types = ['',
    'MicroService',
    'WebApp',
    'NodeJS',
    'Rails',
    'Go'];
  typeSelected = this.types[0];
  cloudOptions = ['AWS', 'Azure', 'GCP'];
  cloudSelected = '';

  deploymentOptions: string[] = [];
  deploymentSelected = '';

  constructor(
    private router: Router,
    private http: HttpClient,
    private jenkins: JenkinsService,
    private authService: AuthServiceService
  ) { }

  ngOnInit() {
  }

  async helpMe(keyword: string) {
    // await this.helperBot.sendShow(true);
    //await this.helperBot.sendMessage(keyword, true);
  }

  selectType(event: any) {
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

  selectCloud(event: any) {
    this.cloudSelected = event.target.value;

    if (this.cloudSelected === 'AWS') {
      this.deploymentOptions = [
        'AWS ECS Fargate',
        'AWS EKS',
        'AWS EC2',
      ];
    }

    if (this.cloudSelected === 'Azure') {
      this.deploymentOptions = [
        'Azure AKS',
        'Azure Container Apps',
        'Azure VM'
      ];
    }

    if (this.cloudSelected === 'GCP') {
      this.deploymentOptions = [
        'GCP GKE',
        'GCP Cloud Run',
        'GCP Compute Engine'
      ];
    }
  }

  selectDeployment(event: any) {
    this.deploymentSelected = event.target.value;
  }

  async submit() {

    this.hasErrors = false;

    // Validate Application Type
    if (this.typeSelected && this.typeSelected.length !== 0) {
      this.correctAppType = true;
    } else {
      this.correctAppType = false;
      this.hasErrors = true;
    }

    // Validate Cloud
    if (this.cloudSelected && this.cloudSelected.length !== 0) {
      this.correctPlatform = true;
    } else {
      this.correctPlatform = false;
      this.hasErrors = true;
    }

    // Validate Deployment Type
    if (this.deploymentSelected && this.deploymentSelected.length !== 0) {
      this.correctPlatform = true;
    } else {
      this.correctPlatform = false;
      this.hasErrors = true;
    }

    // Stop if errors
    if (this.hasErrors) {
      return;
    }

    // For now just log values (we'll connect deployment later)
    console.log("Application Type:", this.typeSelected);
    console.log("Cloud Platform:", this.cloudSelected);
    console.log("Deployment Type:", this.deploymentSelected);

    // Temporary success flow
    this.submitDisabled = true;
    this.submissionInfo = 'Preparing Deployment...';

    await this.delay(2000);

    this.submissionInfo = 'Redirecting...';

    await this.delay(1000);

    this.router.navigateByUrl('/lastBuild');
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
