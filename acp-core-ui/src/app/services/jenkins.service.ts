import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { AwsInfrastructure } from '../models/awsInfrastructure.model';
import { GcpInfrastructure } from '../models/gcpInfrastructure.model';
import { AzureInfrastructure } from '../models/azureInfrastructure.model';
import { MyWebApp } from '../models/myWebApp.model';


@Injectable({
  providedIn: 'root'
})
export class JenkinsService {
   baseurl = '';
   base = 'aceinfosolutions';
   extension = 'jenkinsdev';
   infrastructureJob = 'TerraformDevV2';
   applicationJob = 'Developer-Self-Service-Application-Generator';


  constructor(private http: HttpClient) { }

  checkToken(token: any) {
    return this.http.post( this.baseurl + 'validate/' + token, {}).toPromise();
  }

  createWebApp(webApp: MyWebApp) {
    return this.http.post( this.baseurl + 'createWebApp', webApp.toJSON()).toPromise();
  }
  createInfrastructure(obj: AwsInfrastructure) {
    if (obj.cloudPlatform === 'AWS') {
      const paramString = '?cloudPlatform=' + obj.cloudPlatform + '&landingZone=' + obj.landingZone + '&keyId=' +
        obj.accessKeyId + '&accessKey=' + obj.secretAccessKey + '&region=' + obj.region + '&subnetCount=' +
        obj.subnetCount + '&createdBy=' + obj.createdBy + '&name=' + obj.name;
      return this.http.post( this.baseurl + 'createInfrastructure' + paramString, {}).toPromise();
    }
    else {
      return null;
    }

  }

  createInfrastructureAzure(obj: AzureInfrastructure) {
    return this.http.post( this.baseurl + 'createInfrastructureAzure', obj.toJSON()).toPromise();
  }

  createInfrastructureGCP(obj: GcpInfrastructure) {
    if (obj.cloudPlatform === 'Google') {
      const paramString = '?cloudPlatform=' + obj.cloudPlatform + '&landingZone=' + obj.landingZone + '&projectId=' +
        obj.projectId + '&region=' + obj.region + '&zone=' +
        obj.zone + '&createdBy=' + obj.createdBy + '&name=' + obj.name;
      const body: any = {'credentials': obj.credentials};
      return this.http.post( this.baseurl + 'createInfrastructureGCP' + paramString, obj.toJSON()).toPromise();
    }
    else {
      return null;
    }

  }

  createJobOnInfrastructure(extension: string, job: string) {
    const oclets = extension.split('.');
    // // console.log(oclets);
    return this.http.post( this.baseurl + 'createJobOnInfrastructure/' + oclets[0] + '/' + oclets[1] + '/' + oclets[2] + '/' +
      oclets[3] + '/' + job, {}).toPromise();
  }

  getAllJobOnInfrastructure(extension: string, job: string) {
    const oclets = extension.split('.');
    // // console.log(oclets);
    return this.http.get( this.baseurl + 'getAllInfrastructureBuilds/' + oclets[0] + '/' + oclets[1] + '/' + oclets[2] + '/' +
      oclets[3] + '/' + job, {}).toPromise();
  }

  getAllJobs(extension: string) {
    const oclets = extension.split('.');
    // // console.log(oclets);
    return this.http.get(this.baseurl + 'getAllJobs/' + oclets[0] + '/' + oclets[1] + '/' + oclets[2] + '/' + oclets[3])
      .toPromise().then(res => res ).catch( err => err ).then(res => res ).catch( err => err );
  }
  getArtifacts(id: any) {
    return this.http.get(this.baseurl + 'getArtifacts/' + id)
      .toPromise().then(res => res ).catch( err => err );
  }
  getAllBuilds(user: any) {
    const body: any = {'name': user};
    return this.http.post(this.baseurl + 'getAllApps',
      <JSON>body).toPromise().then(res => res ).catch( err => err );
  }

  getAllAppsJobs(user: any) {
    const body: any = {'name': user};
    return this.http.post(this.baseurl + 'getAllAppsJobs',
      <JSON>body).toPromise().then(res => res ).catch( err => err );
  }

  // /getAllInfrastructureJobs
  getAllInfrastructureJobs(user: any) {
    const body: any = {'name': user};
    return this.http.post(this.baseurl + 'getAllInfrastructureJobs/',
      <JSON>body).toPromise().then(res => res ).catch( err => err );
  }

  getAllLandings(user: any) {
    const body: any = {'name': user};
    return this.http.post(this.baseurl + 'getAllLandings',
      <JSON>body).toPromise();
  }

  getAllScans() {
    return this.http.get(this.baseurl + 'getAllLandings').toPromise();
  }

  getBuildById(id: any, user: any) {
    const body: any = {'name': user, 'id': id};
    return this.http.post(this.baseurl + 'getAppById',
      <JSON>body).toPromise();
  }

  getLandingById(id: any, user: any) {
    const body: any = {'name': user, 'id': id};
    return this.http.post(this.baseurl + 'getLanding/' + id,
      <JSON>body).toPromise();
  }

  getLastBuild(user: any) {
    const body: any = {'name': user};
    return this.http.post(this.baseurl + 'getLastWebApp',
      <JSON>body).toPromise();
  }

  getLastInfrastructure(user: any) {
    const body: any = {'name': user};
    return this.http.post(this.baseurl + 'getLastInfrastructure', <JSON>body).toPromise();
  }
  getBuildStatus(id: any) {
    const body: any = {'name': 'twalton', 'id': id};
    return this.http.post(this.baseurl + 'getWebAppLog',
      <JSON>body).toPromise().then(res => res ).catch( err => err );
  }

  getInfrastructureStatus(id: any) {
    return this.http.get(this.baseurl + 'getInfrastructureStatus?id=' + id)
      .toPromise().then(res => res ).catch( err => err );
  }

  async describeBuildById(id: any, user: any) {
    const body: any = {'name': user, 'id': id};
    const res = await this.http.post(this.baseurl + '/getWebAppById', <JSON>body).
    toPromise().then(r => r ).catch( err => err );
    return res;
  }

  async describeInfrastructureById(id: any) {
    return await this.http.get(this.baseurl + 'getDescibeByInfrastructureId?id=' + id).toPromise();
  }

  async getWebAppUrls(user: any, job: any) {
    const body: any = {'name': user, 'extension': this.extension, 'base': this.base, 'job': job};
    return await this.http.post(this.baseurl + '/getWebAppUrl', <JSON>body).toPromise();
  }

}
