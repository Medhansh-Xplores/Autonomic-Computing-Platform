export class MyBuilds {
  private _id;
  private _name;
  private _git;
  private _cicd;


  get id() {
    return this._id;
  }

  set id(value) {
    this._id = value;
  }

  get name() {
    return this._name;
  }

  set name(value) {
    this._name = value;
  }

  get git() {
    return this._git;
  }

  set git(value) {
    this._git = value;
  }

  get cicd() {
    return this._cicd;
  }

  set cicd(value) {
    this._cicd = value;
  }

  toJSON() {
    return {
      'id': this._id,
      'name': this._name,
      'git': this._git,
      'cicd': this._cicd
    };
  }
}

