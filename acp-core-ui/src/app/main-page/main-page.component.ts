import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AuthServiceService } from '../services/auth-service.service';

@Component({
  selector: 'app-main-page',
  templateUrl: './main-page.component.html',
  styleUrls: ['./main-page.component.css']
})
export class MainPageComponent implements OnInit {

  isLoggedIn = false;

  constructor(private router: Router, private authService: AuthServiceService) { }

  ngOnInit(): void {
    const currentUser = this.authService.currentUserValue;
    const token = this.authService.getToken();
    this.isLoggedIn = !!(currentUser && token);
  }

  navigateGuarded(path: string) {
    const currentUser = this.authService.currentUserValue;
    const token = this.authService.getToken();

    if (currentUser && token) {
      this.router.navigate([path]);
    } else {
      alert('Please login first to continue');
    }
  }

  goToAutomationDeployment() {
    this.router.navigate(['/automation-deployment']);
  }
}