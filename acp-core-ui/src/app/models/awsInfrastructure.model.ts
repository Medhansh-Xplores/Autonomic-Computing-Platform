export class AwsInfrastructure {
    id: string;
    cloudPlatform: string;
    landingZone: string;
    createdBy: string;
    accessKeyId: string;
    secretAccessKey: string;
    region: string;
    subnetCount: string;
    name: string;

    constructor() {
      this.id = '';
      this.cloudPlatform = '';
      this.landingZone = '';
      this.createdBy = '';
      this.accessKeyId = '';
      this.secretAccessKey = '';
      this.region = '';
      this.subnetCount = '';
      this.name = '';
    }
}

// const paramstring = '?cloudPlatform=' + this.platformSelected + '&landingZone=' + this.landingZoneSelected + '&keyId=' +
//     this.obj.accessKeyId + '&accessKey=' + this.obj.secretAccessKey + '&region=' + this.obj.region + '&subnetCount=' +
//     this.obj.subnetCount + '&createdBy=' + this.obj.createdBy + '&name=' + this.obj.name;

