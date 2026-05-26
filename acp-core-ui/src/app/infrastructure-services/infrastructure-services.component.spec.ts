import { ComponentFixture, TestBed } from '@angular/core/testing';

import { InfrastructureServicesComponent } from './infrastructure-services.component';

describe('InfrastructureServicesComponent', () => {
  let component: InfrastructureServicesComponent;
  let fixture: ComponentFixture<InfrastructureServicesComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ InfrastructureServicesComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(InfrastructureServicesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
