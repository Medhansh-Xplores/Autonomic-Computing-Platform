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

  deleteDeployment(event: Event, deployment: any) {
    event.stopPropagation(); // prevent row click from firing

    if (!confirm(`Delete ${deployment.name}? This will destroy it from AWS.`)) return;

    // Optimistically mark as Deleting in the UI
    deployment.status = 'Deleting';

    this.infraService.deleteDeployment(deployment.id).subscribe({
      error: (err) => {
        console.error('Delete failed', err);
        deployment.status = 'Delete Failed';
      }
    });
    // The 5s auto-refresh will eventually remove the row from the list
  }

}