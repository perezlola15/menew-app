import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MenuFormDialogComponent } from './menu-form-dialog.component';

describe('MenuFormDialogComponent', () => {
  let component: MenuFormDialogComponent;
  let fixture: ComponentFixture<MenuFormDialogComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MenuFormDialogComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(MenuFormDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
