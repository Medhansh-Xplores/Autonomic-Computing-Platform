import { Component, Injectable, OnInit } from '@angular/core';
import { HttpClient} from '@angular/common/http';
import { Router} from '@angular/router';
import { IUser } from '../models/user.model';
import { Subscription } from 'rxjs';
import { AuthServiceService} from '../services/auth-service.service';
import { JenkinsService} from '../services/jenkins.service';
import { AwsInfrastructure} from '../models/awsInfrastructure.model';
import { GcpInfrastructure} from '../models/gcpInfrastructure.model';
import { AzureInfrastructure} from '../models/azureInfrastructure.model';
import { FooterComponent} from '../footer/footer.component';

@Component({
  selector: 'app-create-infrastructure',
  templateUrl: './create-infrastructure.component.html',
  styleUrls: ['./create-infrastructure.component.css'],
  providers:[FooterComponent ],
})
export class CreateInfrastructureComponent implements OnInit {
  authSub: Subscription | undefined;
  curUser!: IUser;
  submissionInfo = '';
  submitDisabled = false;
  hasErrors = false;
  obj: any;
  platforms = ['', 'AWS', 'Google', 'Azure', 'AWS - CloudHPC (Coming Soon)', 'Google - CloudHPC (Coming Soon)', 'Azure - CloudHPC (Coming Soon)', 'IBM - Quantum Cloud (Coming Soon)', 'AWS - Quantum Cloud (Coming Soon)'];
  landingZones = ['', 'Landing Zone Only', 'Landing Zone with Jenkins'];
  regions = [ '', 'us-east-2', 'us-east-1', 'us-west-1', 'us-west-2'];
  portfolios = [
  { id: 'ai', name: 'AI Apps' },
  { id: 'internal', name: 'Internal Tools' },
  { id: 'customer', name: 'Customer Apps' }
  ];

  portfolioSelected = ''; 
  gcpRegions = ['', 'us-east4'];
  gcpZone = ['', 'us-east4-b'];
  azureRegion = '';
  platformSelected = this.platforms[0];
  landingZoneSelectedAWS = this.landingZones[0];
  landingZoneSelectedGCP = this.landingZones[0];
  regionSelected = this.regions[0];
  zoneSelected = this.gcpZone[0];
  formData:FormData = new FormData();
  readytoupload:boolean=false;
  selectedFile: File | undefined;
  gcpDefaultFileName = 'gcp_infrastructure_json';
  defaultRegion: string | undefined;

  // Gets called when the user selects an image
  public onFileChanged(event: any) {
    // Select File
    this.selectedFile = event.target.files[0];
  }
  // Gets called when the user clicks on submit to upload the image
  async onUpload(name: any) {
    // // console.log(this.selectedFile);
    // FormData API provides methods and properties to allow us easily prepare form data to be sent with POST HTTP requests.
    const uploadFileData = new FormData();
    // const time = Date.now();
    // const name = this.obj.createdBy + time;
    if( this.selectedFile == null) {
      return new Promise((resolve) => {resolve(820);});
      //uploadFileData.append('file', '', 'file.json');
    }
    else{
      uploadFileData.append('file', this.selectedFile, this.selectedFile.name);
    }
    // Make a call to the Spring Boot Application to save the image
    return await this.http.post('upload/jenkinsdev/aceinfosolutions/TerraformDevV2/' + name, uploadFileData)
      .toPromise();
  }

  constructor(private http: HttpClient, private router: Router, private authService: AuthServiceService,
               private jenkins: JenkinsService, private footer: FooterComponent) {}

  ngOnInit() {
    // // console.log(Date.now());
    //this.footer.showHelpBot();
    this.selectPlatform(0);
  }

  async selectPlatform (index: number) {
    this.hasErrors = false; //clear errors
    
    if (index == 0) {  //AWS
      this.platformSelected = this.platforms[1];
      console.log('You selected ' + this.platformSelected);
      this.obj = new AwsInfrastructure();
      this.authSub =  await this.authService.currentUser.subscribe(
        userAuth => {
          this.curUser = userAuth;
          this.obj.createdBy = this.curUser.userName;
        });
    }

    else if (index == 1) { //GCP
      this.platformSelected = this.platforms[2];
      console.log('You selected ' + this.platformSelected);
      this.obj = new GcpInfrastructure();
      this.authSub =  await this.authService.currentUser.subscribe(
        userAuth => {
          this.curUser = userAuth;
          this.obj.createdBy = this.curUser.userName;
        });
    }

    else if (index == 2) { //Azure
      this.platformSelected = this.platforms[3];
      console.log('You selected ' + this.platformSelected);
      this.obj = new AzureInfrastructure();
      this.authSub =  await this.authService.currentUser.subscribe(
        userAuth => {
          this.curUser = userAuth;
          console.log(this.curUser);
          this.obj.createdBy = this.curUser.userName;
        });
    }
  }

  selectLandingZone(event: any, platform: string) {
    console.log('Landing Zone  is: ' + event.target.value);
    if (platform === 'Google') {
      this.landingZoneSelectedGCP = event.target.value;
      console.log('Landing Zone is: ' + this.landingZoneSelectedGCP)
    }
    if (platform === 'AWS') {
      this.landingZoneSelectedAWS = event.target.value;
      console.log('Landing Zone is: ' + this.landingZoneSelectedAWS)
    }
  }

  selectRegion (event: any) {
    this.regionSelected = event.target.value;
    console.log('Region is: ' + this.regionSelected);
  }

  selectGCPRegion (event: any) {
    this.regionSelected = event.target.value;
    console.log('GCP Region is: ' + this.regionSelected);
  }

  selectGCPZone (event: any) {
    this.zoneSelected = event.target.value;
    console.log('Zone is: ' + this.zoneSelected);
  }

  selectAzureRegion (event: any) {
    this.obj.azureRegion = event.target.value;
    console.log('Region is: ' + this.azureRegion)
  }

  selectSubnetCount(event: any) {
    this.obj.subnetCount = event.target.value;
    console.log('Subnet Count is: ' + this.obj.subnetCount);
  }
  
  selectInfrastructureName(event: any) {
    this.obj.name = event.target.value;
    console.log('Infrastructure name is: ' + this.obj.name);
  }

  selectPortfolio(event: any) {
  this.portfolioSelected = event.target.value;
  console.log('Portfolio selected: ' + this.portfolioSelected);
  }

  selectProjectId(event: any) {
    this.obj.projectId = event.target.value;
    console.log('Project ID is: ' + this.obj.projectId);
  }

  selectAzureClientId(event: any) {
    this.obj.azureClientId = event.target.value;
    console.log('Client ID is: ' + this.obj.azureClientId);
  }

  selectAzureSubscriptionId(event: any) {
    this.obj.azureSubcriptionId = event.target.value;
    console.log('Subscription ID is: ' + this.obj.azureSubId);
  }

  selectAzureTenantId(event: any) {
    this.obj.azureTenantId = event.target.value;
    console.log('Tenant ID is: ' + this.obj.azureTenantId);
  }



  async submit() {
    console.log("You pressed submit");

    // Submit and Validate AWS
    if (this.platformSelected === 'AWS') {

      // assigning data members 
      this.hasErrors = false;
      this.obj.id = null;
      this.obj.cloudPlatform = this.platformSelected;
      this.obj.landingZone= this.landingZoneSelectedAWS;
      this.obj.region = this.regionSelected;
      this.obj.portfolio = this.portfolioSelected;

      // checking if AWS parameters are valid
      if (this.validateAWS(this.obj) === true) {
        console.log ("AWS Validated");

        const res = await this.jenkins.createInfrastructure(this.obj);
        if (res === '201' || res === 201) {

          this.submissionInfo = 'Submitting Request';
          this.submitDisabled = true;
          await this.delay(3000);
          this.submissionInfo = 'Waiting For Acknowledgement of Start of Build';
          await this.delay(6000);
          this.submissionInfo = 'Redirecting to Infrastructure Information Page';
          await this.delay(1000);
          this.router.navigateByUrl('/lastInfrastructure');

        }
      }
      else {
        this.hasErrors = true;
      }
    }
    
    // Submit and Validate Google Gloud
    if (this.platformSelected === 'Google') {

      // assigning data members
      this.hasErrors = false;
      this.obj.id = null;
      this.obj.cloudPlatform = this.platformSelected;
      this.obj.landingZone= this.landingZoneSelectedGCP;
      this.obj.region = this.regionSelected;
      this.obj.zone = this.zoneSelected;

      // chacks validity oif users input
      if (this.validateGCP(this.obj) === true) {
        this.submitDisabled = true;
        const time = Date.now();
        const name = this.obj.createdBy + time;
        const response = await this.onUpload(name);

        if (response === '200' || response === 200) {
          this.obj.credentials = name;
          console.log('file uploaded ' + name );
          const res = await this.jenkins.createInfrastructureGCP(this.obj);

          if (res === '201' || res === 201) {
            this.submissionInfo = 'Submitting Request';
            this.submitDisabled = true;
            await this.delay(3000);
            this.submissionInfo = 'Waiting For Acknowledgement of Start of Build';
            await this.delay(6000);
            this.submissionInfo = 'Redirecting to Infrastructure Information Page';
            await this.delay(1000);
            this.router.navigateByUrl('/lastInfrastructure');
          }
        }
        else if (response === '820' || response === 820) {
          this.obj.credentials = 'gcp_infrastructure_json';
          console.log('no file 820');
          const res = await this.jenkins.createInfrastructureGCP(this.obj);

          if (res === '201' || res === 201) {
            this.submissionInfo = 'Submitting Request';
            this.submitDisabled = true;
            await this.delay(3000);
            this.submissionInfo = 'Waiting For Acknowledgement of Start of Build';
            await this.delay(6000);
            this.submissionInfo = 'Redirecting to Infrastructure Information Page';
            await this.delay(1000);
            this.router.navigateByUrl('/lastInfrastructure');
          }
        }
        else {
        this.hasErrors = true;
        }
      }
    }

    //Submit and Validate Azure//
    if (this.platformSelected === 'Azure') {

      // assigning data members based on user input
      this.hasErrors = false;
      this.obj.id = null;
      this.obj.cloudPlatform = this.platformSelected;
      this.obj.landingZone= '';
      this.obj.zone = this.zoneSelected; 

      // checks validity of Azure parameters
      if (this.validateAzure(this.obj) === true) {
        this.submitDisabled = true;
        this.obj.credentials = name;
        const res = await this.jenkins.createInfrastructureAzure(this.obj);

        if (res === '201' || res === 201) {
          this.submissionInfo = 'Submitting Request';
          this.submitDisabled = true;
          await this.delay(3000);
          this.submissionInfo = 'Waiting For Acknowledgement of Start of Build';
          await this.delay(6000);
          this.submissionInfo = 'Redirecting to Infrastructure Information Page';
          await this.delay(1000);
          this.router.navigateByUrl('/lastInfrastructure');
        }
      }
      else {
        this.hasErrors = true;
      }
    }
  }




  // How The Old Submit Method Works

  // 1. function is called
  // 2. checks to see if input is AWS, Google or Azure
  // 3. sets the object data members to those the user has selected
  // 4. checks to see if input is valid using the ValidateAWS (etc) method
  // 5. if it is valid, it runs createInfrastructure method (found in jenkins file)
  // 6. then if that function returns 201, it cancels build (as far as what I read)

  async submitOld() {
     if (this.validateDropdown(this.platformSelected, this.platforms) && this.platformSelected === 'AWS') {
       this.hasErrors = false;
       this.obj.id = null;
       this.obj.cloudPlatform = this.platformSelected;
       this.obj.landingZone = this.landingZoneSelectedAWS;
       this.obj.region = this.regionSelected;
       if (this.validateAWS(this.obj) === true) {
         // createInfrastructure is a method from Jenbkins.service.ts
         const res = await this.jenkins.createInfrastructure(this.obj);
         if (res === '201' || res === 201) {
           // // console.log('Starting Delay');
           this.submissionInfo = 'Submitting Request';
           this.submitDisabled = true;
           await this.delay(3000);
           this.submissionInfo = 'Waiting For Acknowledgement of Start of Build';
           await this.delay(6000);
           this.submissionInfo = 'Redirecting to Infrastructure Information Page';
           await this.delay(1000);
           // // console.log('Ending Delay');
           this.router.navigateByUrl('/lastInfrastructure');
         }
       } else {
         this.hasErrors = true;
       }
     }
    if (this.validateDropdown(this.platformSelected, this.platforms) && this.platformSelected === 'Google') {
      this.hasErrors = false
      // alert('Submission of Google Cloud Platform Infrastructure is disabled.');
      this.obj.id = null;
      this.obj.cloudPlatform = this.platformSelected;
      this.obj.landingZone = this.landingZoneSelectedGCP;
      this.obj.region = this.regionSelected;
      this.obj.zone = this.zoneSelected;
      // // console.log(this.obj);
      if (this.validateGCP(this.obj) === true) {
        this.submitDisabled = true;
        // // console.log('Passed Validations, starting credentials creation');
        const time = Date.now();
        const name = this.obj.createdBy + time;
        const response = await this.onUpload(name);
        // // console.log(response);
        if (response === '200' || response === 200) {
          // // console.log('Credentials Created, starting creation');
          this.obj.credentials = name;
          console.log('file uploaded ' + name );
          const res = await this.jenkins.createInfrastructureGCP(this.obj);
          if (res === '201' || res === 201) {
            // // console.log('Starting Delay');
            this.submissionInfo = 'Submitting Request';
            this.submitDisabled = true;
            await this.delay(3000);
            this.submissionInfo = 'Waiting For Acknowledgement of Start of Build';
            await this.delay(6000);
            this.submissionInfo = 'Redirecting to Infrastructure Information Page';
            await this.delay(1000);
            // // console.log('Ending Delay');
            this.router.navigateByUrl('/lastInfrastructure');
          }
        }
        else if (response === '820' || response === 820) {
          // // console.log('Credentials Created, starting creation');
          this.obj.credentials = 'gcp_infrastructure_json';
           console.log('no file 820');
          const res = await this.jenkins.createInfrastructureGCP(this.obj);
          if (res === '201' || res === 201) {
            // // console.log('Starting Delay');
            this.submissionInfo = 'Submitting Request';
            this.submitDisabled = true;
            await this.delay(3000);
            this.submissionInfo = 'Waiting For Acknowledgement of Start of Build';
            await this.delay(6000);
            this.submissionInfo = 'Redirecting to Infrastructure Information Page';
            await this.delay(1000);
            // // console.log('Ending Delay');
            this.router.navigateByUrl('/lastInfrastructure');
          }
        }
        else {
          // // console.log('Something horrible went wrong');
        }
      } else {
        this.hasErrors = true;
      }
    }
    if (this.validateDropdown(this.platformSelected, this.platforms) && this.platformSelected === 'Azure') {
      this.hasErrors = false;
      //alert('Submission of Microsoft Azure Infrastructure is disabled.');
      // alert('Submission of Google Cloud Platform Infrastructure is disabled.');
      this.obj.id = null;
      this.obj.cloudPlatform = this.platformSelected;
      this.obj.landingZone = '';
      // // console.log(this.obj);
      if (this.validateAzure(this.obj) === true) {
        this.submitDisabled = true;
         // // console.log('Credentials Created, starting creation');
         this.obj.credentials = name;
         // // console.log('Credentials changed to the key name');
         const res = await this.jenkins.createInfrastructureAzure(this.obj);
         if (res === '201' || res === 201) {
           // // console.log('Starting Delay');
            this.submissionInfo = 'Submitting Request';
            this.submitDisabled = true;
            await this.delay(3000);
            this.submissionInfo = 'Waiting For Acknowledgement of Start of Build';
            await this.delay(6000);
            this.submissionInfo = 'Redirecting to Infrastructure Information Page';
            await this.delay(1000);
            // // console.log('Ending Delay');
            this.router.navigateByUrl('/lastInfrastructure');
          }
      } else {
        this.hasErrors = true;
      }
    }
    if (this.validateDropdown(this.platformSelected, this.platforms) && this.platformSelected === 'AWS - CloudHPC') {
      alert('Submission of CloudHPC Infrastructure is disabled.');
    }
    if (this.validateDropdown(this.platformSelected, this.platforms) && this.platformSelected === 'Google - CloudHPC') {
      alert('Submission of CloudHPC Infrastructure is disabled.');
    }
    if (this.validateDropdown(this.platformSelected, this.platforms) && this.platformSelected === 'Azure - CloudHPC') {
      alert('Submission of CloudHPC Infrastructure is disabled.');
    }
    if (this.validateDropdown(this.platformSelected, this.platforms) && this.platformSelected === 'AWS - Quantum Cloud') {
      alert('Submission of Quantum Cloud is disabled.');
    }
    if (this.validateDropdown(this.platformSelected, this.platforms) && this.platformSelected === 'IBM - Quantum Cloud') {
      alert('Submission of Quantum Cloud is disabled.');
    }
  }




  // custom method for delaying processes 
  public delay(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // validateDropdown is a function that checks to see if an item was first selected from the list (besides an empty string) and then makes
  // sure that the value is in fact included in the list provided.
  public validateDropdown(param: string, list: string | string[]) {
    if (param.length !== 0) {
      return list.indexOf(param) !== -1;
    } else {
      return false;
    }
  }

  // validateCreatedBy is a function that checks to see if the createdBy field has be tampered with and was changed from the curUser that
  // is logged into the application and stored in the sessions.
  public validateCreatedBy(param: string | any[]) {
     return param.length !== 0 && param === this.curUser.userName;
  }

  // validateIsNumber is a function that check to see if the provided parameter is a number.
  public validateIsNumber(param: any) {
    return param.length !== 0 && isNaN(param) === false; 
  }

  // validateNoSpecialCharacters is a function that checks to see if the provided parameter has special characters in the string.
  public validateNoSpecialCharacters(param: string) {
    var regex = /^[A-Za-z0-9 ]+$/;
    return param.length !== 0 && regex.test(param);
    //Old regex pattern -- /[~`!#$%\^&*+=\-\[\] \\';,/{}|\\":<>\?]/
  }


  // validates that param is indeed a string
  public validateIsString(param: any) {
    return param.length !== 0;
  }


  // validates that a AWSInfratsructure object is 
  public validateAWS(obj: AwsInfrastructure) {
     return this.validateDropdown(obj.landingZone, this.landingZones) === true &&
       this.validateIsNumber(obj.subnetCount) === true && this.validateCreatedBy(obj.createdBy) === true &&
       this.validateNoSpecialCharacters(obj.name) === true;
  }

  public validateGCP(obj: GcpInfrastructure) {
    return this.validateDropdown(obj.landingZone, this.landingZones) === true && this.validateIsString(obj.projectId) === true
      && this.validateDropdown(obj.region, this.gcpRegions) === true &&
      this.validateDropdown(obj.zone, this.gcpZone) === true && this.validateCreatedBy(obj.createdBy) === true &&
      this.validateNoSpecialCharacters(obj.name) === true;  
  }

  public validateAzure(obj: AzureInfrastructure) {
    return this.validateDropdown(obj.cloudPlatform, this.platforms) === true &&
      this.validateIsString(obj.azureRegion) === true && this.validateCreatedBy(obj.createdBy) === true &&
      this.validateNoSpecialCharacters(obj.name) === true  ;
  }
}

