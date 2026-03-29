import { Component, OnInit } from '@angular/core';
import { AuthServiceService } from '../services/auth-service.service';
import { Subscription } from 'rxjs';
import { IUser } from '../models/user.model';
import {faPaperPlane, faTimesCircle, faMinusCircle} from '@fortawesome/free-solid-svg-icons';

@Component({
  selector: 'app-footer',
  templateUrl: './footer.component.html',
  styleUrls: ['./footer.component.css']
})
export class FooterComponent implements OnInit {

  authSub : Subscription;
  curUser : IUser | undefined;
  showHelperBot = false;
  faTimesCircle = faTimesCircle;
  faMinusCircle = faMinusCircle;
  message: any;
  toShow: any;
  subscription: Subscription | undefined;
  text = '';
 
  /*
  faAngleUp : faAngleUp;
  faAngleDown : faAngleDown;
  */

  constructor( private authService: AuthServiceService) {
    this.authSub = authService.currentUser.subscribe(
      userAuth => {
        this.curUser = userAuth;
      });
  }


  async ngOnInit() {

  }


  gotoTop() {
    window.scroll({
      top: 0,
      left: 0,
      behavior: 'smooth'
    });
  }


}
