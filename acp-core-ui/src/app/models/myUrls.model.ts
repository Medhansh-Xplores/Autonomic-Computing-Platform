export class MyUrls {
  private _test;
  private _stage;
  private _prod;


  get test() {
    return this._test;
  }

  set test(value) {
    this._test = value;
  }

  get stage() {
    return this._stage;
  }

  set stage(value) {
    this._stage = value;
  }

  get prod() {
    return this._prod;
  }

  set prod(value) {
    this._prod = value;
  }

  toJSON() {
    return {
      'test': this._test,
      'stage': this._stage,
      'prod': this._prod
    };
  }
}

