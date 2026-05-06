import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';

@Component({
    selector: 'app-fullstack-observability',
    templateUrl: './fullstack-observability.component.html',
    styleUrls: ['./fullstack-observability.component.css']
})
export class FullstackObservabilityComponent implements OnInit {

    constructor(private router: Router) { }

    ngOnInit(): void { }

}
