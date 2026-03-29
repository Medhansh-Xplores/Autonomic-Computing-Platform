import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ApplicationResourcesComponent } from './application-resources.component';

describe('ApplicationResourcesComponent', () => {
  let component: ApplicationResourcesComponent;
  let fixture: ComponentFixture<ApplicationResourcesComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ ApplicationResourcesComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ApplicationResourcesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
