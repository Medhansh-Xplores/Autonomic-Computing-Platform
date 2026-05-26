import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TenantInfoComponent } from './tenant-info.component';

describe('TenantInfoComponent', () => {
  let component: TenantInfoComponent;
  let fixture: ComponentFixture<TenantInfoComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ TenantInfoComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(TenantInfoComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
