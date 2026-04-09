import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  selector: 'app-automation-deployment',
  templateUrl: './automation-deployment.component.html',
  styleUrls: ['./automation-deployment.component.css']
})
export class AutomationDeploymentComponent implements OnInit {

  constructor(private router: Router) { }

  ngOnInit(): void {
  }

  deployApp() {
    this.router.navigate(['/deploy-app']);
  }

  runningDeployments() {
    this.router.navigate(['/running-deployments']);
  }

  deploymentTemplates() {
    this.router.navigate(['/deployment-templates']);
  }

}