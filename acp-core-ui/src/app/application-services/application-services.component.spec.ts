import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ApplicationServicesComponent } from './application-services.component';

describe('ApplicationServicesComponent', () => {
  let component: ApplicationServicesComponent;
  let fixture: ComponentFixture<ApplicationServicesComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ ApplicationServicesComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ApplicationServicesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
