export class AzureInfrastructure {
    id: string;
    cloudPlatform: string;
    landingZone: string;
    createdBy: string;
    azureSubscriptionId: string;
    azureClientId: string;
    azureClientSecret: string;
    azureTenantId: string;
    azureRegion: string;
    name: string;

  constructor() {
      this.id = '';
      this.cloudPlatform = '';
      this.landingZone = '';
      this.createdBy = '';
      this.azureSubscriptionId = '';
      this.azureClientId = '';
      this.azureClientSecret = '';
      this.azureTenantId = '';
      this.azureRegion = '';
      this.name = '';
  }

  toJSON() {
      return {
        'ID': this.id,
        'CLOUD_PLATFORM': this.cloudPlatform,
        'LANDING_ZONE': this.landingZone,
        'CREATED_BY': this.createdBy,
        'AZURE_SUBSCRIPTION_ID': this.azureSubscriptionId,
        'AZURE_CLIENT_ID': this.azureClientId,
        'AZURE_CLIENT_SECRET': this.azureClientSecret,
        'AZURE_TENANT_ID': this.azureTenantId,
        'AZURE_REGION': this.azureRegion,
        'NAME': this.name
      };
    }
}

// const paramstring = '?cloudPlatform=' + this.platformSelected + '&landingZone=' + this.landingZoneSelected + '&keyId=' +
//     this.obj.accessKeyId + '&accessKey=' + this.obj.secretAccessKey + '&region=' + this.obj.region + '&subnetCount=' +
//     this.obj.subnetCount + '&createdBy=' + this.obj.createdBy + '&name=' + this.obj.name;

