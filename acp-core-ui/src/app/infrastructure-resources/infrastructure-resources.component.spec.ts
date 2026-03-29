import { ComponentFixture, TestBed } from '@angular/core/testing';

import { InfrastructureResourcesComponent } from './infrastructure-resources.component';

describe('InfrastructureResourcesComponent', () => {
  let component: InfrastructureResourcesComponent;
  let fixture: ComponentFixture<InfrastructureResourcesComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ InfrastructureResourcesComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(InfrastructureResourcesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
