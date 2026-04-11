import { Component, OnInit, Renderer2, ElementRef, ViewChild, AfterViewInit, Directive } from '@angular/core';
import { AuthServiceService } from '../services/auth-service.service';
import { Router, RouterModule, ActivatedRoute } from '@angular/router';
import { first } from 'rxjs/operators';
import { IUser } from '../models/user.model';
import { HttpClient } from '@angular/common/http';
import { EnvService } from 'src/environments/env.service';

@Component({
  selector: 'wizard',
  templateUrl: './wizard.component.html',
  styleUrls: ['./wizard.component.css']
})

export class WizardComponent implements OnInit, AfterViewInit {

  // HARDCODED API BASE
  apiBase = this.envService.apiUrl;
  // HARDCODED LICENSE 27b534a1-bbd1-4ae9-b3ce-37b41414d3af FOR NOW
  licenseNum = "27b534a1-bbd1-4ae9-b3ce-37b41414d3af";

  curUser!: IUser
  divToShow!: number

  platformType!: string;
  accountNum!: string;
  region!: string;
  landingZone!: string;
  zoneName = '';
  blueprintID!: string;
  blueprintDescription!: string;
  VPCname = '';
  networkName = '';
  numItems!: number;
  ClusterName = '';
  ServiceName = '';
  TaskName = '';
  selectedVpc = '';
  vpcs: any[] = [];
  loadingVpcs = false;
  CIDRBlock = "10.0.0.0/16";
  CIDRInput = "";
  publicSubnet!: string;
  privateSubnet!: string;
  isCreating = false;
  vpcId: string = "";
  publicSubnet1: string = '';
  publicSubnet2: string = '';
  privateSubnet1: string = '';
  privateSubnet2: string = '';
  cpu: string = "";
  memory: string = "";
  containerName: string = "";
  containerPort: string = "";
  subnets: any[] = [];
  selectedSubnets: string[] = [];
  clusterName: string = '';
  selectedVpcName: string = '';
  selectedVpcCidr: string = '';
  selectedAccountName: string = '';
  accountName: string = '';
  vpcName: string = '';
  vpcCidr: string = '';
  accounts: any[] = [];
  dbEngine: string = '';
  dbUsername: string = '';
  dbPassword: string = '';
  rdsIdentifier: string = '';
  initialDbName: string = '';
  createInitialDb: boolean = false;

  awsregionlist = [
    { code: "us-east-2", name: "US East (Ohio)" },
    { code: "us-east-1", name: "US East (N. Virginia)" },
    { code: "us-west-1", name: "US West (N. California)" },
    { code: "us-west-2", name: "US West (Oregon)" },
    { code: "af-south-1", name: "Africa (Cape Town)" },
    { code: "ap-east-1", name: "Asia Pacific (Hong Kong)" },
    { code: "ap-south-2", name: "Asia Pacific (Hyderabad)" },
    { code: "ap-southeast-3", name: "Asia Pacific (Jakarta)" },
    { code: "ap-southeast-4", name: "Asia Pacific (Melbourne)" },
    { code: "ap-south-1", name: "Asia Pacific (Mumbai)" },
    { code: "ap-northeast-3", name: "Asia Pacific (Osaka)" },
    { code: "ap-northeast-2", name: "Asia Pacific (Seoul)" },
    { code: "ap-southeast-1", name: "Asia Pacific (Singapore)" },
    { code: "ap-southeast-2", name: "Asia Pacific (Sydney)" },
    { code: "ap-northeast-1", name: "Asia Pacific (Tokyo)" },
    { code: "ca-central-1", name: "Canada (Central)" },
    { code: "eu-central-1", name: "Europe (Frankfurt)" },
    { code: "eu-west-1", name: "Europe (Ireland)" },
    { code: "eu-west-2", name: "Europe (London)" },
    { code: "eu-south-1", name: "Europe (Milan)" },
    { code: "eu-west-3", name: "Europe (Paris)" },
    { code: "eu-south-2", name: "Europe (Spain)" },
    { code: "eu-north-1", name: "Europe (Stockholm)" },
    { code: "eu-central-2", name: "Europe (Zurich)" },
    { code: "me-south-1", name: "Middle East (Bahrain)" },
    { code: "me-central-1", name: "Middle East (UAE)" },
    { code: "sa-east-1", name: "South America (São Paulo)" },
  ];

  azureregionlist = [
    { name: "eastus", regionaldisplayname: "(US) East US" },
    { name: "eastus2", regionaldisplayname: "(US) East US 2" },
    { name: "southcentralus", regionaldisplayname: "(US) South Central US" },
    { name: "westus2", regionaldisplayname: "(US) West US 2" },
    { name: "westus3", regionaldisplayname: "(US) West US 3" },
    { name: "australiaeast", regionaldisplayname: "(Asia Pacific) Australia East" },
    { name: "southeastasia", regionaldisplayname: "(Asia Pacific) Southeast Asia" },
    { name: "northeurope", regionaldisplayname: "(Europe) North Europe" },
    { name: "swedencentral", regionaldisplayname: "(Europe) Sweden Central" },
    { name: "uksouth", regionaldisplayname: "(Europe) UK South" },
    { name: "westeurope", regionaldisplayname: "(Europe) West Europe" },
    { name: "centralus", regionaldisplayname: "(US) Central US" },
    { name: "southafricanorth", regionaldisplayname: "(Africa) South Africa North" },
    { name: "centralindia", regionaldisplayname: "(Asia Pacific) Central India" },
    { name: "eastasia", regionaldisplayname: "	(Asia Pacific) East Asia" },
    { name: "japaneast", regionaldisplayname: "(Asia Pacific) Japan East" },
    { name: "koreacentral", regionaldisplayname: "(Asia Pacific) Korea Central" },
    { name: "canadacentral", regionaldisplayname: "(Canada) Canada Central" },
    { name: "francecentral", regionaldisplayname: "(Europe) France Central" },
    { name: "germanywestcentral", regionaldisplayname: "(Europe) Germany West Central" },
    { name: "norwayeast", regionaldisplayname: "(Europe) Norway East" },
    { name: "switzerlandnorth", regionaldisplayname: "(Europe) Switzerland North" },
    { name: "uaenorth", regionaldisplayname: "(Middle East) UAE North" },
    { name: "brazilsouth", regionaldisplayname: "(South America) Brazil South" },
    { name: "centraluseuap", regionaldisplayname: "(US) Central US EUAP" },
    { name: "eastus2euap", regionaldisplayname: "(US) East US 2 EUAP" },
    { name: "qatarcentral", regionaldisplayname: "(Middle East) Qatar Central" },
    { name: "centralusstage", regionaldisplayname: "(US) Central US (Stage)" },
    { name: "eastusstage", regionaldisplayname: "(US) East US (Stage)" },
    { name: "eastus2stage", regionaldisplayname: "(US) East US 2 (Stage)" },
    { name: "northcentralusstage", regionaldisplayname: "(US) North Central US (Stage)" },
    { name: "southcentralusstage", regionaldisplayname: "(US) South Central US (Stage)" },
    { name: "westusstage", regionaldisplayname: "(US) West US (Stage)" },
    { name: "westus2stage", regionaldisplayname: "(US) West US 2 (Stage)" },
    { name: "asia", regionaldisplayname: "Asia" },
    { name: "asiapacific", regionaldisplayname: "Asia Pacific" },
    { name: "australia", regionaldisplayname: "Australia" },
    { name: "brazil", regionaldisplayname: "Brazil" },
    { name: "canada", regionaldisplayname: "Canada" },
    { name: "europe", regionaldisplayname: "Europe" },
    { name: "france", regionaldisplayname: "France" },
    { name: "germany", regionaldisplayname: "Germany" },
    { name: "global", regionaldisplayname: "Global" },
    { name: "india", regionaldisplayname: "India" },
    { name: "japan", regionaldisplayname: "Japan" },
    { name: "korea", regionaldisplayname: "Korea" },
    { name: "norway", regionaldisplayname: "Norway" },
    { name: "singapore", regionaldisplayname: "Singapore" },
    { name: "southafrica", regionaldisplayname: "South Africa" },
    { name: "switzerland", regionaldisplayname: "Switzerland" },
    { name: "uae", regionaldisplayname: "United Arab Emirates" },
    { name: "uk", regionaldisplayname: "United Kingdom" },
    { name: "unitedstates", regionaldisplayname: "United States" },
    { name: "unitedstateseuap", regionaldisplayname: "United States EUAP" },
    { name: "eastasiastage", regionaldisplayname: "(Asia Pacific) East Asia (Stage)" },
    { name: "southeastasiastage", regionaldisplayname: "(Asia Pacific) Southeast Asia (Stage)" },
    { name: "brazilus", regionaldisplayname: "(South America) Brazil US" },
    { name: "eastusstg", regionaldisplayname: "(US) East US STG" },
    { name: "northcentralus", regionaldisplayname: "(US) North Central US" },
    { name: "westus", regionaldisplayname: "(US) West US" },
    { name: "jioindiawest", regionaldisplayname: "(Asia Pacific) Jio India West" },
    { name: "devfabric", regionaldisplayname: "(US) devfabric" },
    { name: "westcentralus", regionaldisplayname: "(US) West Central US" },
    { name: "southafricawest", regionaldisplayname: "(Africa) South Africa West" },
    { name: "australiacentral", regionaldisplayname: "(Asia Pacific) Australia Central" },
    { name: "australiacentral2", regionaldisplayname: "(Asia Pacific) Australia Central 2" },
    { name: "australiasoutheast", regionaldisplayname: "(Asia Pacific) Australia Southeast" },
    { name: "japanwest", regionaldisplayname: "(Asia Pacific) Japan West" },
    { name: "jioindiacentral", regionaldisplayname: "(Asia Pacific) Jio India Central" },
    { name: "koreasouth", regionaldisplayname: "(Asia Pacific) Korea South" },
    { name: "southindia", regionaldisplayname: "(Asia Pacific) South India" },
    { name: "westindia", regionaldisplayname: "(Asia Pacific) West India" },
    { name: "canadaeast", regionaldisplayname: "(Canada) Canada East" },
    { name: "francesouth", regionaldisplayname: "(Europe) France South" },
    { name: "germanynorth", regionaldisplayname: "(Europe) Germany North" },
    { name: "norwaywest", regionaldisplayname: "(Europe) Norway West" },
    { name: "switzerlandwest", regionaldisplayname: "(Europe) Switzerland West" },
    { name: "ukwest", regionaldisplayname: "(Europe) UK West" },
    { name: "uaecentral", regionaldisplayname: "(Middle East) UAE Central" },
    { name: "brazilsoutheast", regionaldisplayname: "(South America) Brazil Southeast" },
  ];

  @ViewChild('optionsLanding', { static: false }) optionsLanding!: ElementRef
  @ViewChild('accountsAWS', { static: false }) accountsAWS!: ElementRef;
  @ViewChild('accountsAzure', { static: false }) accountsAzure!: ElementRef;
  @ViewChild('accountsGCP', { static: false }) accountsGCP!: ElementRef;
  @ViewChild('accountsEKS', { static: false }) accountsEKS!: ElementRef;
  @ViewChild('regionsAWS', { static: false }) regionsAWS!: ElementRef;
  @ViewChild('regionsAzure', { static: false }) regionsAzure!: ElementRef;
  @ViewChild('regionsGCP', { static: false }) regionsGCP!: ElementRef;
  @ViewChild('regionsEKS', { static: false }) regionsEKS!: ElementRef;
  @ViewChild('accountsECS', { static: false }) accountsECS!: ElementRef;
  @ViewChild('accountsRDS', { static: false }) accountsRDS!: ElementRef;

  constructor(private router: Router,
    private route: ActivatedRoute,
    private authService: AuthServiceService,
    private http: HttpClient,
    private renderer: Renderer2,
    private el: ElementRef,
    private envService: EnvService
  ) {
    if (this.authService.currentUserValue) {
      this.curUser = this.authService.currentUserValue;
      this.router.navigate(['']);
    }
  }


  ngOnInit() {
    this.divToShow = 1;
  }

  ngAfterViewInit() {

    // AWS Accounts
    this.http.get<any>(this.apiBase + "tenants/" + this.licenseNum + "/accounts?platformTypeFilter=AWS")
      .subscribe(data => {
        this.numItems = data.length;
        let tempVal = "";
        tempVal = "<select> <option value='null'>--- Choose an Option ---</option>";

        for (let i = 0; i < this.numItems; i++) {
          tempVal += "<option value='" + data[i].accountID + "'>"
            + data[i].accountName + ": " + data[i].accountID + "</option>";
        }

        tempVal += "</select>";

        this.renderer.setProperty(this.accountsAWS.nativeElement, 'innerHTML', tempVal);
        this.renderer.setProperty(this.accountsEKS.nativeElement, 'innerHTML', tempVal);
        this.renderer.setProperty(this.accountsECS.nativeElement, 'innerHTML', tempVal);
        this.renderer.setProperty(this.accountsRDS.nativeElement, 'innerHTML', tempVal);
      });


    // AZURE Accounts
    this.http.get<any>(this.apiBase + "tenants/" + this.licenseNum + "/accounts?platformTypeFilter=AZURE")
      .subscribe(data => {
        this.numItems = data.length;
        let tempVal = "";
        tempVal = "<select> <option value='null'>--- Choose an Option ---</option>";

        for (let i = 0; i < this.numItems; i++) {
          tempVal += "<option value='" + data[i].accountID + "'>"
            + data[i].accountName + ": " + data[i].accountID + "</option>";
        }

        tempVal += "</select>";

        this.renderer.setProperty(this.accountsAzure.nativeElement, 'innerHTML', tempVal);
      });


    // GCP Accounts
    this.http.get<any>(this.apiBase + "tenants/" + this.licenseNum + "/accounts?platformTypeFilter=GCP")
      .subscribe(data => {
        this.numItems = data.length;
        let tempVal = "";
        tempVal = "<select> <option value='null'>--- Choose an Option ---</option>";

        for (let i = 0; i < this.numItems; i++) {
          tempVal += "<option value='" + data[i].accountID + "'>"
            + data[i].accountName + ": " + data[i].accountID + "</option>";
        }

        tempVal += "</select>";

        this.renderer.setProperty(this.accountsGCP.nativeElement, 'innerHTML', tempVal);
      });

  }

  changePage(e: any) {

    let changeNum = Number(e.target.value);

    if (changeNum == 0) {
      this.router.navigate(["/"]);
    }

    else if (changeNum == -1 || changeNum == -2) {

      // FIRST PAGE VALIDATION
      if (this.divToShow == 1) {

        if (!this.blueprintID || !this.zoneName) {
          alert("Please fill all required fields");
          return;
        }
      }

      // SECOND PAGE VALIDATION
      if (this.divToShow == 2 && this.blueprintID == "aws-vpc") {

        if (
          !this.accountNum ||
          !this.region ||
          !this.VPCname ||
          !this.CIDRBlock ||
          !this.publicSubnet ||
          !this.privateSubnet
        ) {
          alert("Please fill all required fields");
          return;
        }
      }

      if (this.blueprintID == "aws-vpc") {
        this.blueprintDescription = "AWS Virtual Private Cloud (VPC)";
        changeNum = 2;
      }

      else if (this.blueprintID == "azure-vpc") {
        changeNum = 3;
        this.blueprintDescription = "Azure Virtual Private Cloud";
      }

      else if (this.blueprintID == "gcp-vpc") {
        this.blueprintDescription = "GCP Virtual Private Cloud";
        changeNum = 4;
      }

      else if (this.blueprintID == "aws-eks-fargate") {
        this.blueprintDescription = "AWS Elastic Kubernetes Service (EKS) with Fargate";
        changeNum = 5;
      }

      else if (this.blueprintID == "aws-ecs") {
        this.blueprintDescription = "AWS ECS with Fargate";
        changeNum = 7;
      }

      else if (this.blueprintID == "aws-rds") {
        this.blueprintDescription = "AWS RDS";
        this.rdsIdentifier = this.zoneName;
        changeNum = 9;
      }

      else {
        alert("Please choose a valid platform type.")
        changeNum = 1;
      }
    }

    // ADD HERE
    if (changeNum == 6 && this.blueprintID == "aws-vpc") {
      if (
        !this.accountNum ||
        !this.region ||
        !this.VPCname ||
        !this.CIDRBlock ||
        !this.publicSubnet1 ||
        !this.publicSubnet2 ||
        !this.privateSubnet1 ||
        !this.privateSubnet2
      ) {
        alert("Please fill all required fields");
        return;
      }
    }

    if (changeNum == 7 && this.blueprintID == "aws-ecs") {
      this.ClusterName = this.zoneName;
    }

    if (this.divToShow == 7 && this.blueprintID == "aws-ecs") {
      if (
        !this.accountNum ||
        !this.region ||
        !this.ClusterName
      ) {
        alert("Please fill all required fields");
        return;
      }
    }

    // RDS VALIDATION
    if (changeNum == 10 && this.blueprintID == "aws-rds") {

      if (
        !this.accountNum ||
        !this.region ||
        !this.dbEngine ||
        !this.rdsIdentifier ||
        !this.dbUsername ||
        !this.dbPassword ||
        !this.vpcId
      ) {
        alert("Please fill all required fields");
        return;
      }

      if (this.createInitialDb && !this.initialDbName) {
        alert("Please enter Initial Database Name");
        return;
      }

    }

    this.divToShow = changeNum;
  }

  onPlatformChange(e: any) {
    //The platform has been changed, we need to GET their options.
    this.platformType = e.target.value;

    this.http.get<any>(this.apiBase + "blueprints?platformTypeFilter=" + this.platformType).subscribe(data => {
      this.numItems = data.items.length;
      let tempVal = "";
      tempVal = "<option value='null'>--- Choose an Option ---</option>";

      for (let i = 0; i < this.numItems; i++) {
        tempVal += `<option value='${data.items[i].blueprintID}'>${data.items[i].blueprintDescription}</option>`;
      }

      this.renderer.setProperty(this.optionsLanding.nativeElement, 'innerHTML', tempVal);
    })

    //alert(this.platformType)
  }

  onZoneNameChange(e: any) {
    this.zoneName = e.target.value;
    this.VPCname = this.zoneName;
  }

  onVPCNameChange(e: any) {
    this.VPCname = e.target.value;
  }

  onClusterNameChange(e: any) {
    this.ClusterName = e.target.value;
  }

  onAccountChange(e: any) {

    this.accountNum = e.target.value;

    const selected = this.accounts.find(
      (a: any) => a.accountID === this.accountNum
    );

    this.accountName = selected?.accountName;

    this.loadVpcs();

  }

  onRegionChange(e: any) {
    this.region = e.target.value;
    this.loadVpcs();

    //alert(this.region)
  }

  loadVpcs() {

    if (!this.accountNum || !this.region) {
      return;
    }

    this.loadingVpcs = true;

    this.http.get<any[]>(
      this.apiBase + "vpcs?accountId=" + this.accountNum + "&region=" + this.region
    ).subscribe({

      next: (data) => {
        this.vpcs = data;
        this.loadingVpcs = false;
      },

      error: (err) => {
        console.error(err);
        this.loadingVpcs = false;
      }

    });
  }

  loadSubnets() {

    if (!this.vpcId || !this.region) {
      return;
    }

    this.http.get<any[]>(
      this.apiBase + "subnets?vpcId=" + this.vpcId + "&region=" + this.region
    ).subscribe({

      next: (data) => {
        this.subnets = data;
      },

      error: (err) => {
        console.error(err);
      }

    });

  }

  onVpcChange(e: any) {

    this.vpcId = e.target.value;

    const selected = this.vpcs.find(
      (v: any) => v.vpcId === this.vpcId
    );

    this.vpcName = selected?.name;
    this.vpcCidr = selected?.cidr;

    this.loadSubnets();

  }

  onBlueprintChange(e: any) {
    this.blueprintID = e.target.value;
  }

  validateCIDR(cidr: string): boolean {
    const cidrRegex = /^(\d{1,3}\.){3}\d{1,3}\/\d{1,2}$/;
    return cidrRegex.test(cidr);
  }

  onCIDRBlockChange(e: any) {
    const value = e.target.value;
    if (this.validateCIDR(value)) {
      this.CIDRBlock = value;
    } else {
      alert("Not Valid CIDR Block Address");
    }
  }

  onPublicSubnetChange(e: any) {
    this.publicSubnet = e.target.value;
  }

  onPrivateSubnetChange(e: any) {
    this.privateSubnet = e.target.value;
  }

  onPublicSubnet1Change(e: any) {
    this.publicSubnet1 = e.target.value;
  }

  onPublicSubnet2Change(e: any) {
    this.publicSubnet2 = e.target.value;
  }

  onPrivateSubnet1Change(e: any) {
    this.privateSubnet1 = e.target.value;
  }

  onPrivateSubnet2Change(e: any) {
    this.privateSubnet2 = e.target.value;
  }

  validateIP(ip: string): boolean {
    const ipPattern = /^((25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
    return ipPattern.test(ip);
  }


  submitForProcessing() {
    // We have all of our information, it's time to POST it.
    // DIFFERENT POSTS FOR DIFFERENT LANDING ZONES, DIFFERENT JSONS FOR DIFFERENT PLATFORMS
    if (this.blueprintID == "aws-vpc") {
      // AWS STANDARD
      // Auto generate AZs
      const az1 = this.region + "a";
      const az2 = this.region + "b";

      const body = {
        tenantID: this.licenseNum,
        blueprintID: this.blueprintID,
        blueprintRelease: "8.7.8",
        accountID: this.accountNum,
        region: this.region,
        vpcName: this.VPCname,
        cidr: this.CIDRBlock,

        public_subnet_1: this.publicSubnet1,
        public_subnet_2: this.publicSubnet2,
        private_subnet_1: this.privateSubnet1,
        private_subnet_2: this.privateSubnet2,

        az_1: az1,
        az_2: az2
      };
      //SEND IT OFF
      this.isCreating = true;

      this.http.post<any>(this.apiBase + 'deployments/aws-vpc', body).subscribe({
        next: (data) => {
          console.log("NAVIGATING TO LOGS");
          this.isCreating = false;
          this.router.navigate(['/deployment-logs'], {
            state: { infraType: this.blueprintDescription }
          });
        },
        error: (err) => {
          console.error(err);
          this.isCreating = false;
          alert("Deployment failed");
        }
      });

    }

    if (this.blueprintID == "aws-ecs") {

      const body = {

        tenantID: this.licenseNum,
        blueprintID: this.blueprintID,
        account: this.accountNum,
        region: this.region,
        clusterName: this.ClusterName,
        vpcId: this.vpcId,
        cpu: this.cpu,
        memory: this.memory,
        zoneName: this.zoneName

      };

      this.isCreating = true;

      this.http.post<any>(
        this.apiBase + "deployments/aws-ecs",
        body
      ).subscribe({

        next: () => {

          this.isCreating = false;

          this.router.navigate(['/deployment-logs'], {
            state: { infraType: this.blueprintDescription }
          });

        },

        error: (err) => {

          console.error(err);
          this.isCreating = false;

        }

      });

    }

    else if (this.blueprintID == "aws-rds") {

      const body = {

        tenantID: this.licenseNum,
        blueprintID: this.blueprintID,

        accountID: this.accountNum,
        region: this.region,

        rdsIdentifier: this.rdsIdentifier,
        dbEngine: this.dbEngine,

        username: this.dbUsername,
        password: this.dbPassword,

        vpcId: this.vpcId,

        createInitialDb: this.createInitialDb,
        initialDbName: this.initialDbName,

        zoneName: this.zoneName

      };

      this.isCreating = true;

      this.http.post<any>(
        this.apiBase + "deployments/aws-rds",
        body
      ).subscribe({

        next: () => {

          this.isCreating = false;

          this.router.navigate(['/deployment-logs'], {
            state: { infraType: this.blueprintDescription }
          });

        },

        error: (err) => {

          console.error(err);
          this.isCreating = false;
          alert("Deployment failed");

        }

      });

    }

    else if (this.blueprintID == "awseksfargate") {
      // AWS EKS WITH FARGATE
      const body = {
        "tenantID": this.licenseNum,
        "blueprintID": this.blueprintID,
        "blueprintRelease": "0.8.6",
        "accountID": this.accountNum,
        "region": this.region,
        "vpcName": this.VPCname,
        "clusterName": this.ClusterName
      }
      //SEND IT OFF
      this.http.post<any>(this.apiBase + 'tenants/' + this.licenseNum + '/deployments/AWS-EKS-FARGATE', { body }).subscribe(data => {
        console.log(data)
      });
    }
    else if (this.blueprintID == "azurvpc") {
      // AZURE
      const body = {
        "tenantID": this.licenseNum,
        "blueprintID": this.blueprintID,
        "blueprintRelease": "4.1.4",
        "accountID": this.accountNum,
        "region": this.region,
        "vpcName": this.VPCname,
        "cidr": this.CIDRBlock
      }
      //SEND IT OFF
      this.http.post<any>(this.apiBase + 'tenants/' + this.licenseNum + '/deployments/AZURE-VPC', { body }).subscribe(data => {
        console.log(data)
      });
    }
    else if (this.blueprintID == "gcpvpc") {
      // GOOGLE CLOUD PLATFORM
      const body = {
        "tenantID": this.licenseNum,
        "blueprintID": this.blueprintID,
        "blueprintRelease": "8.6.6",
        "accountID": this.accountNum,
        "region": this.region,
        "vpcName": this.VPCname,
        "cidr": this.CIDRBlock
      }
      //SEND IT OFF
      this.http.post<any>(this.apiBase + 'tenants/' + this.licenseNum + '/deployments/GCP-VPC', { body }).subscribe(data => {
        console.log(data)
      });
    }
  }

}