import { Component, OnInit } from '@angular/core';
import { IUser } from '../models/user.model';
import { AuthServiceService } from '../services/auth-service.service';
import { Router, NavigationEnd } from '@angular/router';
import { Subscription } from 'rxjs';
import { ActivatedRoute, Params } from '@angular/router';
import { MatDialog, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { faUserCircle, faSignOutAlt, faHome, faFolderOpen, faSitemap, faFileAlt } from '@fortawesome/free-solid-svg-icons';
import { faCloud } from '@fortawesome/free-solid-svg-icons';
import { filter } from 'rxjs/operators';


@Component({
  selector: 'app-header',
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.css']
})
export class HeaderComponent implements OnInit {

  faSitemap = faSitemap;
  faFileAlt = faFileAlt;
  faFolderOpen = faFolderOpen;
  faUserCircle = faUserCircle;
  faSignOutAlt = faSignOutAlt;
  faHome = faHome;
  authSub: Subscription;
  curUser: IUser | undefined;
  ResourceSubMenuOpen: boolean = false;
  faCloud = faCloud;
  showTitleBanner = true;

  constructor(private authService: AuthServiceService,
    private router: Router,
    public dialog: MatDialog
  ) {

    this.authSub = authService.currentUser.subscribe(
      userAuth => {
        this.curUser = userAuth;
      });

    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe((event: any) => {
      const hideOn = ['/login', '/signup', '/confirm', '/newuser', '/newuser'];
      this.showTitleBanner = !hideOn.some(path => event.url.includes(path));
    });

  }

  get isLoginPage(): boolean {
    return this.router.url === '/login'
      || this.router.url === '/'
      || this.router.url === '/about'
      || this.router.url.startsWith('/about?')
      || this.router.url === '/contact';
  }

  ngOnInit() {
  }

  logOutUser() {
    this.authService.logOut();
    this.router.navigate(['login']);
  }

  resourceSubmenu() {
    if (this.ResourceSubMenuOpen == true) {
      this.ResourceSubMenuOpen = false;
    }
    else if (this.ResourceSubMenuOpen == false) {
      this.ResourceSubMenuOpen = true;
    }
  }

}