export class MyWebApp {
  private _appType: any;
  private _targetPlatform: any;
  private _appName: any;
  private _appPort: any;
  private _memoryLimit: any;
  private _endPoint: any;
  private _image: any;
  private _user: any;

  get appType() {
    return this._appType;
  }

  set appType(value) {
    this._appType = value;
  }

  get targetPlatform() {
    return this._targetPlatform;
  }

  set targetPlatform(value) {
    this._targetPlatform = value;
  }

  get appName() {
    return this._appName;
  }

  set appName(value) {
    this._appName = value;
  }

  get appPort() {
    return this._appPort;
  }

  set appPort(value) {
    this._appPort = value;
  }

  get memoryLimit() {
    return this._memoryLimit;
  }

  set memoryLimit(value) {
    this._memoryLimit = value;
  }

  get endPoint() {
    return this._endPoint;
  }

  set endPoint(value) {
    this._endPoint = value;
  }

  get image() {
    return this._image;
  }

  set image(value) {
    this._image = value;
  }

  get user() {
    return this._user;
  }

  set user(value) {
    this._user = value;
  }

  toJSON() {
    return {
      'appType': this._appType,
      'platform': this._targetPlatform,
      'appName': this._appName,
      'appPort': this._appPort,
      'memoryLimit': this._memoryLimit,
      'endPoint': this._endPoint,
      'image': this._image,
      'user': this._user
    };
  }
}

