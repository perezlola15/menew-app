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

  getCategoryInitial(category: number): string {
    switch (category) {
      case 1: return '1°';
      case 2: return '2°';
      case 3: return 'D';
      default: return '?';
    }
  }

  // Método para exportar a CSV
  exportToCSV(): void {
    const data = this.dayData();
    if (!data || this.getDishesWithSelections().length === 0) {
      alert('No hay datos para exportar');
      return;
    }

    const dishes = this.getDishesWithSelections();

    // Encabezados CSV
    const headers = ['Dish Name', 'Category', 'Times Selected'];

    // Filas de datos
    const csvData = dishes.map(dish => [
      `"${dish.name.replace(/"/g, '""')}"`, // Escapar comillas
      `"${dish.category_name}"`,
      dish.selection_count.toString()
    ]);

    // Combinar encabezados y datos
    const csvContent = [
      headers.join(','),
      ...csvData.map(row => row.join(','))
    ].join('\n');

    // Crear blob y descargar
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const fileName = `dish-count-${data.date}.csv`;

    // Crear enlace de descarga
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', fileName);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  // Método para exportar a Excel (TSV)
  exportToExcel(): void {
    const data = this.dayData();
    if (!data || this.getDishesWithSelections().length === 0) {
      alert('No hay datos para exportar');
      return;
    }

    const dishes = this.getDishesWithSelections();

    // Encabezados
    const headers = ['Dish Name', 'Category', 'Times Selected'];

    // Filas de datos
    const tsvData = dishes.map(dish => [
      dish.name,
      dish.category_name,
      dish.selection_count.toString()
    ]);

    // Combinar encabezados y datos (usar tab como separador)
    const tsvContent = [
      headers.join('\t'),
      ...tsvData.map(row => row.join('\t'))
    ].join('\n');

    // Crear blob y descargar
    const blob = new Blob([tsvContent], { type: 'application/vnd.ms-excel;charset=utf-8;' });
    const fileName = `dish-count-${data.date}.xls`;

    // Crear enlace de descarga
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', fileName);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  // Método único que exporta según el formato
  exportData(format: 'csv' | 'excel' = 'csv'): void {
    if (format === 'csv') {
      this.exportToCSV();
    } else {
      this.exportToExcel();
    }
  }
}