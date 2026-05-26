import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { EnvService } from '../../environments/env.service';

@Injectable({
    providedIn: 'root'
})
export class InfraService {

    constructor(private http: HttpClient, private envService: EnvService) { }

    private get url(): string {
        return this.envService.apiUrl + 'deployments';
    }

    getDeployments() {
        return this.http.get<any[]>(this.url);
    }

    deleteDeployment(id: string) {
        return this.http.delete(`${this.url}/${id}`);
    }
}