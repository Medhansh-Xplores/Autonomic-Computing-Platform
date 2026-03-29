import { Component, OnInit, ViewChild, ElementRef } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { EnvService } from 'src/environments/env.service';

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

  status = "Creating Infrastructure...";
  isComplete = false;

  @ViewChild('scrollContainer') private scrollContainer!: ElementRef;

  constructor(
    private http: HttpClient,
    private router: Router,
    private envService: EnvService
  ) {
    this.apiBase = this.envService.apiUrl;
  }

  ngOnInit() {

    this.intervalId = setInterval(() => {

      this.http.get<any>(this.apiBase + 'logs')
        .subscribe((data: any) => {

          this.logs = data;

          // Auto scroll
          if (this.logs.length !== this.previousLength) {
            this.previousLength = this.logs.length;

            setTimeout(() => {
              this.scrollToBottom();
            }, 100);
          }

          // Infra created
          if (data.includes("INFRA_CREATED")) {

            clearInterval(this.intervalId);

            this.status = "Infrastructure Created ✅";
            this.isComplete = true;

          }

        });

    }, 2000);

  }

  goBack() {
    this.router.navigate(['/services']);
  }

  scrollToBottom() {
    try {
      this.scrollContainer.nativeElement.scrollTop =
        this.scrollContainer.nativeElement.scrollHeight;
    } catch (err) {}
  }

}