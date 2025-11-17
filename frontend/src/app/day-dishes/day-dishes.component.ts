import { Component, signal, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { BackendService, DayDishesDetailed } from '../services/backend.service';

@Component({
  selector: 'app-day-dishes-detailed',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './day-dishes.component.html'
})
export class DayDishesDetailedComponent {
  private backendService = inject(BackendService);

  // Signals
  selectedDate: string = '';
  dayData = signal<DayDishesDetailed | null>(null);
  isLoading = signal(false);

  // Computed properties - Solo platos con selecciones
  getDishesWithSelections = computed(() => {
    const data = this.dayData();
    if (!data) return [];
    return data.dishes.filter(dish => dish.selection_count > 0);
  });

  getTotalSelections = computed(() => {
    return this.getDishesWithSelections().reduce((total, dish) => total + dish.selection_count, 0);
  });

  getCategorySummary() {
    const dishes = this.getDishesWithSelections();
    const categories = [
      { id: 1, name: 'Primer Plato' },
      { id: 2, name: 'Segundo Plato' }, 
      { id: 3, name: 'Postre' }
    ];

    return categories.map(cat => {
      const categoryDishes = dishes.filter(dish => dish.category === cat.id);
      return {
        name: cat.name,
        total: categoryDishes.reduce((sum, dish) => sum + dish.selection_count, 0),
        count: categoryDishes.length
      };
    }).filter(cat => cat.count > 0);
  }

  loadDayDishes(): void {
    if (!this.selectedDate) return;

    this.isLoading.set(true);
    this.dayData.set(null);

    this.backendService.getDayDishesDetailed(this.selectedDate).subscribe({
      next: (data) => {
        this.dayData.set(data);
        this.isLoading.set(false);
      },
      error: (error) => {
        console.error('Error loading day dishes:', error);
        this.isLoading.set(false);
        if (error.status !== 404) {
          alert('Error al cargar el conteo de platos');
        }
      }
    });
  }

  formatDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString('es-ES', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }
}