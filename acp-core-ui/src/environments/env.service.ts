import { Injectable } from "@angular/core"

export enum Environment {
    Prod = 'prod',
    Dev = 'dev',
    Local = 'local',
  }
  
  @Injectable({ providedIn: 'root' })
  export class EnvService {
    private _env!: Environment 
    private _apiUrl!: string
  
    get env(): Environment {
      return this._env
    }
  
    get apiUrl(): string {
      return this._apiUrl
    }
  
    constructor() {}
  
    init(): Promise<void> {
      return new Promise((resolve) => {
        this.setEnvVariables()
        resolve()
      })
    }
  
    private setEnvVariables(): void {
      const hostname = window && window.location && window.location.hostname
  
      if (/^.*localhost.*/.test(hostname)) {
        this._env = Environment.Local
        this._apiUrl = 'http://localhost:8080/api/v1/'
      } else if (/^acp-dev.autonomicsolutionsllc.com/.test(hostname)) {
        this._env = Environment.Dev
        this._apiUrl = 'https://acp-dev.autonomicsolutionsllc.com/api/v1/'
      } else if (/^acp.autonomicsolutionsllc.com/.test(hostname)) {
        this._env = Environment.Prod
        this._apiUrl = 'https://acp.autonomicsolutionsllc.com/api/v1/'
      } else {
        console.warn(`Cannot find environment for host name ${hostname}`)
      }
    }
  }