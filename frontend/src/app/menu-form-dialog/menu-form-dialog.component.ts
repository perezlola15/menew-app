import { Component, Inject } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Dish, MenuSelectionPayload } from '../services/backend.service';

export interface MenuFormData {
  date: string;
  firstDishes: Dish[];
  secondDishes: Dish[];
  desserts: Dish[];
}

@Component({
  selector: 'app-menu-form-dialog',
  standalone: true,
  imports: [FormsModule, CommonModule],
  templateUrl: './menu-form-dialog.component.html',
})
export class MenuFormDialogComponent {

  menuSelection: MenuSelectionPayload = {
    day: '',
    firstDishId: null,
    secondDishId: null,
    dessertId: null
  };

  constructor(
    public dialogRef: MatDialogRef<MenuFormDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: MenuFormData
  ) {
    this.menuSelection.day = data.date;
  }

  save() {
    if (!this.menuSelection.firstDishId || !this.menuSelection.secondDishId || !this.menuSelection.dessertId) {
      alert('Selecciona un plato de cada categoría');
      return;
    }
    this.dialogRef.close(this.menuSelection); // Devuelve los datos al componente padre
  }

  cancel() {
    this.dialogRef.close();
  }
}
