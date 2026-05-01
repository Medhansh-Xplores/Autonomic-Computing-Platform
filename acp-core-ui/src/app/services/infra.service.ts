import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';

@Injectable({
    providedIn: 'root'
})
export class InfraService {

    constructor(private http: HttpClient) { }

    getDeployments() {
        return this.http.get<any[]>('http://localhost:8080/api/v1/deployments');
    }

    deleteDeployment(id: string) {
        return this.http.delete(`http://localhost:8080/api/v1/deployments/${id}`);
    }

}