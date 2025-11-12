import { Component, OnInit, signal, computed, inject } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
// Eliminados los imports de interfaces de platos y DayDishStatus
import { BackendService, DayInfo } from '../services/backend.service'; 
// Imports necesarios
import { FullCalendarModule } from '@fullcalendar/angular';
import { FullCalendarComponent } from '@fullcalendar/angular';

import { CalendarOptions } from '@fullcalendar/core';
import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin from '@fullcalendar/interaction';
import esLocale from '@fullcalendar/core/locales/es';
import { MatDialog } from '@angular/material/dialog';
import { ViewChild, NgZone, Inject, PLATFORM_ID } from '@angular/core';
import { MenuFormDialogComponent, MenuFormData } from '../menu-form-dialog/menu-form-dialog.component';

@Component({
  selector: 'app-admin',
  standalone: true,
  // Solo se necesita CommonModule, FormsModule (para el diálogo), y FullCalendarModule
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
  // daysWithMenus ya no es necesario para la funcionalidad del calendario tal como está
  // daysWithMenus: string[] = []; 
  isBrowser = false;

  // DayInfo State
  days = signal<DayInfo[]>([]);

  // General Message
  message = signal<{ text: string, type: 'success' | 'error' } | null>(null);

  constructor(
    private backendService: BackendService,
    private zone: NgZone,
    private dialog: MatDialog,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {
    this.isBrowser = isPlatformBrowser(this.platformId);
  }

  ngOnInit(): void {
    // Solo carga días, ya no carga platos (loadDishes eliminado)
    this.loadDays();

    if (this.isBrowser) {
      this.loadCalendarData();
    }
  }

  // --- Helper ---
  showMessage(text: string, type: 'success' | 'error'): void {
    this.message.set({ text, type });
    setTimeout(() => this.message.set(null), 5000);
  }

  // --- Lógica del Calendario y Bloqueo/Menú ---

  loadCalendarData(): void {
    // Cargar días disponibles
    this.backendService.getAvailableDays().subscribe({
      next: (days) => {
        this.availableDaysFull = days;

        // Se puede simplificar la lógica de daysWithMenus si solo se usa para marcar días
        // Si no se usa para marcar en el calendario, se elimina la comprobación asíncrona.
        // Asumiendo que se elimina la marca visual:
        
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
    blockBtn.className = `text-xs px-2 py-1 rounded ${day.blocked ? 'bg-yellow-500 text-white' : 'bg-red-500 text-white'}`;
    // Usar la zona de Angular para actualizar el estado después del evento DOM
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
        this.loadCalendarData(); // recargar vista para actualizar botones
      },
      error: () => this.showMessage('Error al guardar asignaciones.', 'error')
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
        // Actualiza la lista principal de días
        this.days.update(d => d.map(dI => dI.id === updatedDay.id ? updatedDay : dI));
        // Actualiza la lista para el calendario (para que cambie el botón)
        this.availableDaysFull = this.availableDaysFull.map(dI => dI.id === updatedDay.id ? updatedDay : dI);
        
        const action = newState ? 'bloqueado' : 'desbloqueado';
        this.showMessage(`Día ${updatedDay.date.split('T')[0]} ${action} con éxito.`, 'success');
        
        // El calendario se actualiza implícitamente al modificar availableDaysFull y re-renderizar los botones
        // Aunque FullCalendar no re-renderiza celdas automáticamente, el cambio de availableDaysFull
        // ya cambia el texto de los botones gracias a que el listener de click usa zone.run()
      },
      error: (err) => {
        this.showMessage('Error al cambiar el estado del día.', 'error');
        console.error(err);
      }
    });
  }
}
// Nota: La lógica de DayDishesState y sus métodos se han eliminado ya que no se usan sin la pestaña 'dishes'