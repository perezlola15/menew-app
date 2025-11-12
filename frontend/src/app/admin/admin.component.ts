import { Component, OnInit, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { BackendService, Dish, DayInfo, DayDishStatus } from '../services/backend.service';
// Imports necesarios
import { FullCalendarModule } from '@fullcalendar/angular';
import { FullCalendarComponent } from '@fullcalendar/angular';

import { CalendarOptions, EventInput } from '@fullcalendar/core';
import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin from '@fullcalendar/interaction';
import esLocale from '@fullcalendar/core/locales/es';
import { MatDialog } from '@angular/material/dialog';
import { ViewChild, NgZone, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { MenuFormDialogComponent, MenuFormData } from '../menu-form-dialog/menu-form-dialog.component';

// --- Interfaces de Componente ---
interface DishForm {
  name: string;
  category: number;
}
interface Tab {
  key: 'calendar' | 'dishes';
  label: string;
}

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [CommonModule, FormsModule, FullCalendarModule],
  templateUrl: './admin.component.html',
  styleUrl: './admin.component.scss'
})
export class AdminComponent implements OnInit {
  // --- Calendario ---
@ViewChild('fullcalendar') calendarComponent!: FullCalendarComponent;

calendarOptions: CalendarOptions = {
  plugins: [dayGridPlugin, interactionPlugin],
  initialView: 'dayGridMonth',
  locale: esLocale,
  headerToolbar: {
    left: 'prev,next today',
    center: 'title',
    right: ''
  },
  dayCellDidMount: (arg) => {},
  editable: false,
  selectable: false,
  events: [],
};

availableDaysFull: DayInfo[] = [];
daysWithMenus: string[] = [];
isBrowser = false;

constructor(
  private backendService: BackendService,
  private zone: NgZone,
  private dialog: MatDialog,
  @Inject(PLATFORM_ID) private platformId: Object
) {
  this.isBrowser = isPlatformBrowser(this.platformId);
}

ngOnInit(): void {
  this.loadDishes(); // sigue como antes
  this.loadDays();   // sigue como antes

  if (this.isBrowser) {
    this.loadCalendarData();
  }
}

loadCalendarData(): void {
  // Cargar días disponibles
  this.backendService.getAvailableDays().subscribe({
    next: async (days) => {
      this.availableDaysFull = days;

      // Verificar qué días tienen platos
      const daysWithMenus: string[] = [];
      for (const day of days) {
        try {
          const dishes = await this.backendService.getDayDishStatus(day.id).toPromise();
          if (dishes && dishes.some(d => d.is_assigned)) {
            daysWithMenus.push(day.date.split('T')[0]);
          }
        } catch (err) {
          console.error('Error comprobando día:', err);
        }
      }

      this.daysWithMenus = daysWithMenus;
      this.calendarOptions = {
        ...this.calendarOptions,
        dayCellDidMount: this.handleDayDidMount.bind(this)
      };
    },
    error: err => console.error('Error cargando días:', err)
  });
}

handleDayDidMount(arg: any) {
  const date = arg.date;
  const dateStr = date.toISOString().split('T')[0];
  const container = arg.el.querySelector('.fc-daygrid-day-events');

  // Buscar el día
  const day = this.availableDaysFull.find(d => d.date.startsWith(dateStr));
  if (!day) return;

  // Crear contenedor
  const wrapper = document.createElement('div');
  wrapper.className = 'flex flex-col space-y-1 p-1';

  // Botón bloquear/desbloquear
  const blockBtn = document.createElement('button');
  blockBtn.innerText = day.blocked ? 'Desbloquear' : 'Bloquear';
  blockBtn.className = `text-xs px-2 py-1 rounded ${
    day.blocked ? 'bg-yellow-500 text-white' : 'bg-red-500 text-white'
  }`;
  blockBtn.onclick = () => this.zone.run(() => this.toggleDayBlock(day));

  // Botón editar platos
  const menuBtn = document.createElement('button');
  menuBtn.innerText = 'Asignar platos';
  menuBtn.className = 'text-xs px-2 py-1 rounded bg-blue-600 text-white';
  menuBtn.onclick = () => this.zone.run(() => this.openAssignMenuDialog(day));

  wrapper.appendChild(blockBtn);
  wrapper.appendChild(menuBtn);

  if (container) container.appendChild(wrapper);
}
openAssignMenuDialog(day: DayInfo): void {
  this.backendService.getDayDishStatus(day.id).subscribe({
    next: (status) => {
      const first = status.filter(d => d.category === 1);
      const second = status.filter(d => d.category === 2);
      const desserts = status.filter(d => d.category === 3);

      const dialogRef = this.dialog.open(MenuFormDialogComponent, {
        width: '500px',
        data: {
          date: day.date.split('T')[0],
          dayId: day.id,
          firstDishes: first,
          secondDishes: second,
          desserts
        } as MenuFormData
      });

      dialogRef.afterClosed().subscribe((result) => {
        if (result) this.saveDayDishesFromDialog(day.id, result);
      });
    },
    error: (err) => this.showMessage('Error al cargar platos del día.', 'error')
  });
}

saveDayDishesFromDialog(dayId: number, result: any): void {
  const assignedIds = [
    result.firstDishId,
    result.secondDishId,
    result.dessertId
  ].filter(Boolean);

  this.backendService.updateDayDishes(dayId, assignedIds).subscribe({
    next: (res) => {
      this.showMessage('Platos asignados correctamente.', 'success');
      this.loadCalendarData(); // recargar vista
    },
    error: () => this.showMessage('Error al guardar asignaciones.', 'error')
  });
}

  // --- State Signals ---
  activeTab = signal<'calendar' | 'dishes'>('calendar');

  tabs: Tab[] = [
    { key: 'calendar', label: 'Calendario (Bloqueo / Menús)' },
    { key: 'dishes', label: 'Platos (CRUD)' }
  ];

  // Dishes State
  dishes = signal<Dish[]>([]);
  dishForm: DishForm = { name: '', category: 1 };
  editingDishId = signal<number | null>(null);
  isEditingDish = computed(() => this.editingDishId() !== null);

  // Days State
  days = signal<DayInfo[]>([]);

  // DayDishes State
  selectedDayId = signal<number | null>(null);
  dayDishStatus = signal<DayDishStatus[]>([]);
  isSavingDayDishes = signal(false);

  // General Message
  message = signal<{ text: string, type: 'success' | 'error' } | null>(null);

  // --- Computed Properties ---
  sortedDishes = computed(() => {
    // Ordenar por categoría y luego por nombre
    return [...this.dishes()].sort((a, b) => {
      if (a.category !== b.category) {
        return a.category - b.category;
      }
      return a.name.localeCompare(b.name);
    });
  });

  sortedDays = computed(() => {
    // Ordenar por fecha
    return [...this.days()].sort((a, b) => a.date.localeCompare(b.date));
  });

  sortedDayDishStatus = computed(() => {
    // Ordenar por categoría
    return [...this.dayDishStatus()].sort((a, b) => a.category - b.category);
  });


  setActiveTab(key: 'calendar' | 'dishes'): void {
    this.activeTab.set(key);
    this.message.set(null); // Limpiar mensajes al cambiar de pestaña
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
      error: (err) => console.error('Error cargando platos:', err)
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

  // --- Días (Bloqueo/Desbloqueo) ---

  loadDays(): void {
    this.backendService.getAvailableDays().subscribe({
      next: (days) => this.days.set(days),
      error: (err) => console.error('Error cargando días:', err)
    });
  }

  toggleDayBlock(day: DayInfo): void {
    const newState = !day.blocked;
    this.backendService.updateDayBlockStatus(day.id, newState).subscribe({
      next: (updatedDay) => {
        this.days.update(d => d.map(dI => dI.id === updatedDay.id ? updatedDay : dI));
        const action = newState ? 'bloqueado' : 'desbloqueado';
        this.showMessage(`Día ${updatedDay.date.split('T')[0]} ${action} con éxito.`, 'success');
      },
      error: (err) => {
        this.showMessage('Error al cambiar el estado del día.', 'error');
        console.error(err);
      }
    });
  }

  // --- Días-Platos (Asignación) ---

  loadDayDishStatus(): void {
    const dayId = this.selectedDayId();
    this.dayDishStatus.set([]);

    if (dayId !== null) {
      this.backendService.getDayDishStatus(dayId).subscribe({
        next: (status) => this.dayDishStatus.set(status),
        error: (err) => {
          this.showMessage('Error cargando la asignación de platos para el día.', 'error');
          console.error(err);
        }
      });
    }
  }

  saveDayDishes(): void {
    const dayId = this.selectedDayId();
    if (dayId === null) return;

    this.isSavingDayDishes.set(true);
    const assignedDishIds = this.dayDishStatus()
      .filter(dish => dish.is_assigned)
      .map(dish => dish.id);

    this.backendService.updateDayDishes(dayId, assignedDishIds).subscribe({
      next: (res) => {
        this.showMessage(res.message, 'success');
        // Re-cargar el estado para confirmar
        this.loadDayDishStatus();
      },
      error: (err) => {
        this.showMessage('Error al guardar las asignaciones.', 'error');
        console.error(err);
      },
      complete: () => {
        this.isSavingDayDishes.set(false);
      }
    });
  }
}