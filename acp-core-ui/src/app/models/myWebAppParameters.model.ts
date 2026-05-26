export class MyWebAppParameter {
  get date() {
    return this._date;
  }

  set date(value) {
    this._date = value;
  }
  get id() {
    return this._id;
  }

  set id(value) {
    this._id = value;
  }

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

  get result() {
    return this._result;
  }

  set result(value) {
    this._result = value;
  }

  get cicd() {
    return this._cicd;
  }

  set cicd(value) {
    this._cicd = value;
  }
  private _id;
  private _appType;
  private _targetPlatform;
  private _appName;
  private _appPort;
  private _memoryLimit;
  private _endPoint;
  private _image;
  private _user;
  private _result;
  private _cicd;
  private _git;
  private _date;

  get git() {
    return this._git;
  }

  set git(value) {
    this._git = value;
  }

  public MyWebAppParameter() {
    this._id = '';
    this._appType = '';
    this._targetPlatform = '';
    this._appName = '';
    this._appPort = '';
    this._memoryLimit = '';
    this._endPoint = '';
    this._image = '';
    this._user = '';
    this._result = '';
    this._cicd = '';
    this._git = '';
    this._date = '';
  }

}

