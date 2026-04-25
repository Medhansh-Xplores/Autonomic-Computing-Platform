import { Component, OnInit } from '@angular/core';
import { IUser } from '../models/user.model';
import { AuthServiceService } from '../services/auth-service.service';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { ActivatedRoute, Params } from '@angular/router';
import { MatDialog, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
// import { ModalDialogConceptComponent } from '../modal-dialog-concept/modal-dialog-concept.component';
// import { ModalDialogPlaybookComponent } from '../modal-dialog-playbook/modal-dialog-playbook.component';
import { faUserCircle, faSignOutAlt, faHome, faFolderOpen, faSitemap, faFileAlt } from '@fortawesome/free-solid-svg-icons';
import { faCloud } from '@fortawesome/free-solid-svg-icons';


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

  constructor(private authService: AuthServiceService,
    private router: Router,
    public dialog: MatDialog
  ) {

    this.authSub = authService.currentUser.subscribe(
      userAuth => {
        this.curUser = userAuth;
      });


  }

  ngOnInit() {
    // // console.log('in header, curUser:'+JSON.stringify(this.curUser));
  }

  logOutUser() {
    this.authService.logOut();
    this.router.navigate(['login']);
    // // console.log('logging out!');
  }

  // clickConcept(){
  //   const dialogRef = this.dialog.open(ModalDialogConceptComponent, {

  //         width: '75%',
  //   });

  // }
  // clickPlaybook(){
  //   const dialogRef = this.dialog.open(ModalDialogPlaybookComponent, {

  //         width: '75%',
  //     //data: {name: "pdf file", summary: "here is a file", file: obj}
  //   });

  // }

  resourceSubmenu() {
    if (this.ResourceSubMenuOpen == true) {
      this.ResourceSubMenuOpen = false;
    }
    else if (this.ResourceSubMenuOpen == false) {
      this.ResourceSubMenuOpen = true;
    }
  }

}

