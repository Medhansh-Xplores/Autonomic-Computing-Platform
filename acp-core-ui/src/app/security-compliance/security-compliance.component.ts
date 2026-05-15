import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';

@Component({
    selector: 'app-security-compliance',
    templateUrl: './security-compliance.component.html',
    styleUrls: ['./security-compliance.component.css']
})
export class SecurityComplianceComponent implements OnInit {

    constructor(private router: Router) { }

    ngOnInit(): void { }

}
