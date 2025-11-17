import { Component, OnInit, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { BackendService, Dish } from '../services/backend.service'; // Asegúrate de que la ruta sea correcta
import { Observable } from 'rxjs';

// --- Interfaces ---
interface DishForm {
  name: string;
  category: number;
}

@Component({
  selector: 'app-admin-dishes',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-dishes.component.html',
  styleUrl: './admin-dishes.component.scss'
})
export class AdminDishesComponent implements OnInit {
  // Inyección de dependencias
  private backendService = inject(BackendService);

  // --- State Signals ---
  dishes = signal<Dish[]>([]);
  dishForm: DishForm = { name: '', category: 1 };
  editingDishId = signal<number | null>(null);

  // General Message
  message = signal<{ text: string, type: 'success' | 'error' } | null>(null);

  // --- Computed Properties ---
  isEditingDish = computed(() => this.editingDishId() !== null);

  sortedDishes = computed(() => {
    // Ordenar por categoría y luego por nombre
    return [...this.dishes()].sort((a, b) => {
      if (a.category !== b.category) {
        return a.category - b.category;
      }
      return a.name.localeCompare(b.name);
    });
  });

  ngOnInit(): void {
    this.loadDishes();
  }

  // --- Helper ---
  dishCategory(category: number): string {
    switch (category) {
      case 1: return 'Primer Plato';
      case 2: return 'Segundo Plato';
      case 3: return 'Postre';
      default: return 'Desconocido';
    }
  }

  showMessage(text: string, type: 'success' | 'error'): void {
    this.message.set({ text, type });
    setTimeout(() => this.message.set(null), 5000);
  }

  // --- Platos CRUD ---

  loadDishes(): void {
    this.backendService.getAvailableDishes().subscribe({
      next: (dishes) => this.dishes.set(dishes),
      error: (err) => {
        this.showMessage('Error cargando platos.', 'error');
        console.error('Error cargando platos:', err);
      }
    });
  }

  resetForm(): void {
    this.dishForm = { name: '', category: 1 };
    this.editingDishId.set(null);
  }

  editDish(dish: Dish): void {
    this.dishForm = { name: dish.name, category: dish.category };
    this.editingDishId.set(dish.id);
  }

  saveDish(): void {
    if (this.isEditingDish()) {
      this.backendService.updateDish(this.editingDishId()!, this.dishForm).subscribe({
        next: (updatedDish) => {
          this.dishes.update(d => d.map(dish => dish.id === updatedDish.id ? updatedDish : dish));
          this.showMessage(`Plato "${updatedDish.name}" actualizado con éxito.`, 'success');
          this.resetForm();
        },
        error: (err) => {
          this.showMessage('Error al editar el plato.', 'error');
          console.error(err);
        }
      });
    } else {
      this.backendService.addDish(this.dishForm).subscribe({
        next: (newDish) => {
          this.dishes.update(d => [...d, newDish]);
          this.showMessage(`Plato "${newDish.name}" añadido con éxito.`, 'success');
          this.resetForm();
        },
        error: (err) => {
          this.showMessage('Error al añadir el plato.', 'error');
          console.error(err);
        }
      });
    }
  }

  deleteDish(id: number): void {
    if (!confirm('¿Estás seguro de que quieres eliminar este plato?')) return;

    this.backendService.deleteDish(id).subscribe({
      next: () => {
        this.dishes.update(d => d.filter(dish => dish.id !== id));
        this.showMessage('Plato eliminado con éxito.', 'success');
      },
      error: (err) => {
        this.showMessage('Error al eliminar el plato. Podría estar en uso.', 'error');
        console.error(err);
      }
    });
  }
  getCategoryInitial(category: number): string {
  switch(category) {
    case 1: return '1°';
    case 2: return '2°';
    case 3: return 'P';
    default: return '?';
  }
}
}