export class MyParameter {
  private _id;
  private _cloudProvider;
  private _infrastructureType;
  private _name;
  private _createdBy;
  private _awsRegion;
  private _subnet;
  private _gcpRegion;
  private _gcpZone;
  private _gcpProjectId;
  private _elasticIp;
  private _result;
  private _azureRegion;

  get azureRegion() {
    return this._azureRegion;
  }

  set azureRegion(value) {
    this._azureRegion = value;
  }

  public MyParameter() {
    this._id = '';
    this._cloudProvider = '';
    this._infrastructureType = '';
    this._name = '';
    this._createdBy = '';
    this._awsRegion = '';
    this._subnet = '';
    this._gcpRegion = '';
    this._gcpZone = '';
    this._gcpProjectId = '';
    this._elasticIp = '';
    this._result = '';
    this._azureRegion = '';
  }

  get id() {
    return this._id;
  }

  set id(id) {
  this._id = id;
}

get cloudProvider() {
  return this._cloudProvider;
}

set cloudProvider (cloudProvider) {
  this._cloudProvider = cloudProvider;
}

get infrastructureType() {
  return this._infrastructureType;
}

set infrastructureType(infrastructureType) {
  this._infrastructureType = infrastructureType;
}

get name() {
  return this._name;
}

set name(name) {
  this._name = name;
}

get createdBy() {
  return this._createdBy;
}

set createdBy(createdBy) {
  this._createdBy = createdBy;
}

get awsRegion() {
  return this._awsRegion;
}

set awsRegion(awsRegion) {
  this._awsRegion = awsRegion;
}

get subnet() {
  return this._subnet;
}

set subnet(subnet) {
  this._subnet = subnet;
}

get gcpRegion() {
  return this._gcpRegion;
}

set gcpRegion(gcpRegion) {
  this._gcpRegion = gcpRegion;
}

get gcpZone() {
  return this._gcpZone;
}

set gcpZone(gcpZone) {
  this._gcpZone = gcpZone;
}

get gcpProjectId() {
  return this._gcpProjectId;
}

set gcpProjectId(gcpProjectId) {
  this._gcpProjectId = gcpProjectId;
}

  get elasticIp() {
    return this._elasticIp;
  }

  set elasticIp(elasticIp) {
    this._elasticIp = elasticIp;
  }

  get result() {
    return this._result;
  }

  set result(result) {
    this._result = result;
  }
}

// const paramstring = '?cloudPlatform=' + this.platformSelected + '&landingZone=' + this.landingZoneSelected + '&keyId=' +
//     this.obj.accessKeyId + '&accessKey=' + this.obj.secretAccessKey + '&region=' + this.obj.region + '&subnetCount=' +
//     this.obj.subnetCount + '&createdBy=' + this.obj.createdBy + '&name=' + this.obj.name;

