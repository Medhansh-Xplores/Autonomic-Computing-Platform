import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { EnvService } from '../../environments/env.service';

export interface CloudAccount {
    id?: number;
    accountId: string;
    accountName: string;
    region: string;
    authType?: 'role' | 'keys';
    roleArn?: string;
    externalId?: string;
    accessKeyId?: string;
    secretAccessKey?: string;
    isDefault?: boolean;
    provider?: string;
}

@Injectable({ providedIn: 'root' })
export class CloudAccountService {

    constructor(private http: HttpClient, private envService: EnvService) { }

    private get url(): string {
        return this.envService.apiUrl + 'cloud-accounts';
    }

    getNewExternalId() {
        return this.http.get<{ externalId: string }>(`${this.url}/new-external-id`);
    }

    getAccounts() {
        return this.http.get<CloudAccount[]>(this.url);
    }

    addAccount(account: CloudAccount) {
        return this.http.post<CloudAccount>(this.url, account);
    }

    updateAccount(id: number, account: CloudAccount) {
        return this.http.put<CloudAccount>(`${this.url}/${id}`, account);
    }

    deleteAccount(id: number) {
        return this.http.delete(`${this.url}/${id}`);
    }

    setDefault(id: number) {
        return this.http.put(`${this.url}/${id}/set-default`, {});
    }

    hasAccounts() {
        return this.getAccounts();
    }

    verifyConnection(id: number) {
        return this.http.post<{ verified: boolean; message: string }>(`${this.url}/${id}/verify`, {});
    }
}