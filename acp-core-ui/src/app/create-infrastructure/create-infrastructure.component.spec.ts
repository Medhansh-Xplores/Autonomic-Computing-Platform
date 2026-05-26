import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CreateInfrastructureComponent } from './create-infrastructure.component';

describe('CreateInfrastructureComponent', () => {
  let component: CreateInfrastructureComponent;
  let fixture: ComponentFixture<CreateInfrastructureComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ CreateInfrastructureComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(CreateInfrastructureComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
