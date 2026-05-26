export class GcpInfrastructure {
    id: string;
    cloudPlatform: string;
    landingZone: string;
    createdBy: string;
    projectId: string;
    credentials: string;
    region: string;
    zone: string;
    name: string;

    constructor() {
      this.id = '';
      this.cloudPlatform = '';
      this.landingZone = '';
      this.createdBy = '';
      this.projectId = '';
      this.credentials = 'None';
      this.region = '';
      this.zone = '';
      this.name = '';
    }

    toJSON() {
      return {
        'credentials': this.credentials
      };
    }
}

// const paramstring = '?cloudPlatform=' + this.platformSelected + '&landingZone=' + this.landingZoneSelected + '&keyId=' +
//     this.obj.accessKeyId + '&accessKey=' + this.obj.secretAccessKey + '&region=' + this.obj.region + '&subnetCount=' +
//     this.obj.subnetCount + '&createdBy=' + this.obj.createdBy + '&name=' + this.obj.name;

