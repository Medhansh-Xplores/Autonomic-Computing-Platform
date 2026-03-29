import { Component, OnInit, OnDestroy } from '@angular/core';
import { InfraService } from '../services/infra.service';

@Component({
  selector: 'app-infrastructure-resources',
  templateUrl: './infrastructure-resources.component.html',
  styleUrls: ['./infrastructure-resources.component.css']
})
export class InfrastructureResourcesComponent implements OnInit, OnDestroy {

  deployments: any[] = [];
  interval: any;

  constructor(private infraService: InfraService) { }

  ngOnInit(): void {
    this.loadDeployments();

    // Auto refresh every 5 seconds
    this.interval = setInterval(() => {
      this.loadDeployments();
    }, 5000);
  }

  ngOnDestroy(): void {
    clearInterval(this.interval);
  }

  loadDeployments() {
    console.log("Loading deployments...");

    this.infraService.getDeployments().subscribe((data: any) => {

      console.log("Deployments received:", data);

      this.deployments = data;
    });
  }

  openDeployment(deployment: any) {
    console.log("Opening deployment:", deployment);
  }

}