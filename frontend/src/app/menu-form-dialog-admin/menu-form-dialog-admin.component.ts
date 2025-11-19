import { Component, Inject } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Dish } from '../services/backend.service';

export interface MenuFormAdminData {
  date: string;
  dayId: number; // 0 si no existe
  allDishes: Dish[]; // todos los platos
  assignedDishIds: number[]; // ids ya asignados
}

@Component({
  selector: 'app-menu-form-dialog-admin',
  standalone: true,
  imports: [FormsModule, CommonModule],
  templateUrl: './menu-form-dialog-admin.component.html',
})
export class MenuFormDialogAdminComponent {
  selectedFirst: number[] = [];
  selectedSecond: number[] = [];
  selectedDessert: number[] = [];

  constructor(
    public dialogRef: MatDialogRef<MenuFormDialogAdminComponent>,
    @Inject(MAT_DIALOG_DATA) public data: MenuFormAdminData
  ) {
    const assignedIds = new Set(data.assignedDishIds);

    // 💡 INICIALIZACIÓN: Mapeamos los objetos Dish a sus IDs
    this.selectedFirst = data.allDishes
      .filter(d => d.category === 1 && assignedIds.has(d.id))
      .map(d => d.id); // Guardamos solo el ID

    this.selectedSecond = data.allDishes
      .filter(d => d.category === 2 && assignedIds.has(d.id))
      .map(d => d.id); // Guardamos solo el ID

    this.selectedDessert = data.allDishes
      .filter(d => d.category === 3 && assignedIds.has(d.id))
      .map(d => d.id); // Guardamos solo el ID
  }

  
  save() {
    const dishIds = [
      ...this.selectedFirst,
      ...this.selectedSecond,
      ...this.selectedDessert,
    ];

    if (dishIds.length === 0) {
      alert('Select at least one dish.');
      return;
    }

    this.dialogRef.close({
      date: this.data.date,
      dishIds,
    });
  }

  cancel() {
    this.dialogRef.close();
  }
  get firstDishes(): Dish[] {
    return this.data.allDishes.filter(d => d.category === 1);
  }

  get secondDishes(): Dish[] {
    return this.data.allDishes.filter(d => d.category === 2);
  }

  get desserts(): Dish[] {
    return this.data.allDishes.filter(d => d.category === 3);
  }

}
