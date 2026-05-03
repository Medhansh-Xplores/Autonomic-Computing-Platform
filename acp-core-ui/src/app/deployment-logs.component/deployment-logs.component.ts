import { Component, OnInit, ViewChild, ElementRef } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { EnvService } from 'src/environments/env.service';
import { ActivatedRoute } from '@angular/router';

@Component({
  selector: 'app-deployment-logs',
  templateUrl: './deployment-logs.component.html',
  styleUrls: ['./deployment-logs.component.css']
})
export class DeploymentLogsComponent implements OnInit {

  logs: string[] = [];
  apiBase: string;
  intervalId: any;
  previousLength = 0;
  currentStep = 1;
  status = "Creating Infrastructure...";
  isComplete = false;

  infraType = "";   // NEW

  @ViewChild('scrollContainer') private scrollContainer!: ElementRef;

  constructor(
    private http: HttpClient,
    private router: Router,
    private envService: EnvService,
    private route: ActivatedRoute,
  ) {
    this.apiBase = this.envService.apiUrl;

    // Get infra type from router state
    const navigation = this.router.getCurrentNavigation();
    this.infraType = navigation?.extras?.state?.['infraType'] || "";

    if (this.infraType) {
      this.status = "Creating Infrastructure: " + this.infraType;
    }
  }

  ngOnInit() {

    this.route.queryParams.subscribe(params => {

      if (params['step']) {
        this.currentStep = Number(params['step']);
      }

    });

    this.intervalId = setInterval(() => {

      this.http.get<any>(this.apiBase + 'logs')
        .subscribe((data: any) => {

          this.logs = data;

          if (this.logs.length !== this.previousLength) {
            this.previousLength = this.logs.length;

            setTimeout(() => {
              this.scrollToBottom();
            }, 100);
          }

          if (data.includes("INFRA_CREATED")) {
            clearInterval(this.intervalId);
            this.status = "Infrastructure Created ✅";
            this.isComplete = true;
          }

          if (data.includes("INFRA_FAILED")) {
            clearInterval(this.intervalId);
            this.status = "Infrastructure Failed ❌";
            this.isComplete = true;
          }

        });

    }, 5000);

  }

  goBack() {
    this.router.navigate(['/infrastructure-resources']);
  }

  scrollToBottom() {
    try {
      this.scrollContainer.nativeElement.scrollTop =
        this.scrollContainer.nativeElement.scrollHeight;
    } catch (err) { }
  }

}