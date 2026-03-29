import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ApplicationRntComponent } from './application-rnt.component';

describe('ApplicationRntComponent', () => {
  let component: ApplicationRntComponent;
  let fixture: ComponentFixture<ApplicationRntComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ ApplicationRntComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ApplicationRntComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
