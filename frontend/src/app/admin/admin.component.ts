import { Component, OnInit, signal, computed, inject } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
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
  imports: [CommonModule, FormsModule, FullCalendarModule],
  templateUrl: './admin.component.html',
  styleUrl: './admin.component.scss'
})
export class AdminComponent implements OnInit {
  // --- Calendar ---
  @ViewChild('fullcalendar') calendarComponent!: FullCalendarComponent;

  calendarOptions: CalendarOptions; // Defined in constructor for correct binding

  availableDaysFull: DayInfo[] = [];
  isBrowser = false;

  // DayInfo State (Used in AdminDays if exists, otherwise redundant)
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

    // FIX: Set the calendar options here to ensure dayCellDidMount is bound correctly from the start
    this.calendarOptions = {
      plugins: [dayGridPlugin, interactionPlugin],
      initialView: 'dayGridMonth',
      locale: esLocale,
      headerToolbar: {
        left: 'prev,next today',
        center: 'title',
        right: ''
      },
      // Bind the handler immediately
      dayCellDidMount: this.handleDayDidMount.bind(this),
      editable: false,
      selectable: false,
      events: [],
    };
  }

  ngOnInit(): void {
    if (this.isBrowser) {
      // FIX: Load data on init
      this.loadCalendarData();
    }
  }

  // --- Helper ---
  showMessage(text: string, type: 'success' | 'error'): void {
    this.message.set({ text, type });
    setTimeout(() => this.message.set(null), 5000);
  }

  // --- Calendar and Data Logic ---

  loadCalendarData(): void {
    // Load available days
    this.backendService.getAvailableDays().subscribe({
      next: (days) => {
        this.availableDaysFull = days;
        this.days.set(days); // Update signal state

        // The previous attempt to use .render() is generally correct, 
        // but if the calendar hasn't finished its first render cycle, it might fail.
        // We rely on the polling inside handleDayDidMount now, 
        // but keep the render() call after data load for when moving months.
        if (this.calendarComponent) {
          this.zone.run(() => {
            // Forcing a render here ensures that if we navigate months, 
            // the new cells trigger dayCellDidMount with the data present.
            this.calendarComponent.getApi().render();
          });
        }
      },
      error: err => console.error('Error loading days:', err)
    });
  }

  handleDayDidMount(arg: any) {
    // Si los días aún no cargaron, volver a intentar en 100ms
    if (this.availableDaysFull.length === 0) {
      setTimeout(() => this.handleDayDidMount(arg), 100);
      return;
    }

    const date = arg.date;
    const dateStr = date.toISOString().split('T')[0];
    const container = arg.el.querySelector('.fc-daygrid-day-events');

    // Buscar si el día tiene datos asociados
    const day = this.availableDaysFull.find(d => d.date.startsWith(dateStr));
    if (!day) return;

    // Crear contenedor para los botones
    const wrapper = document.createElement('div');
    wrapper.className = 'd-flex flex-column gap-1 p-1';

    // --- Botón de Bloquear / Desbloquear ---
    const blockBtn = document.createElement('button');
    blockBtn.innerText = day.blocked ? 'Desbloquear' : 'Bloquear';
    blockBtn.className = `btn btn-sm w-100 ${day.blocked ? 'btn-warning' : 'btn-danger'}`;

    // Click: alternar el estado bloqueado del día
    blockBtn.onclick = () => this.zone.run(() => {
      const latestDay = this.availableDaysFull.find(d => d.id === day.id);
      if (!latestDay) {
        console.error('No se encontró el día con ID:', day.id);
        return;
      }

      const newBlockedState = !latestDay.blocked;

      // Actualizar el botón visualmente (optimista)
      blockBtn.innerText = newBlockedState ? 'Desbloquear' : 'Bloquear';
      blockBtn.classList.toggle('btn-danger', !newBlockedState);
      blockBtn.classList.toggle('btn-warning', newBlockedState);

      // Persistir cambio en backend
      this.toggleDayBlock(latestDay);
    });

    // --- Botón de Asignar Platos ---
    const menuBtn = document.createElement('button');
    menuBtn.innerText = 'Asignar Platos';
    menuBtn.className = 'btn btn-sm btn-primary w-100';
    menuBtn.onclick = () => this.zone.run(() => this.openAssignMenuDialog(day));

    // Agregar botones al contenedor
    wrapper.appendChild(blockBtn);
    wrapper.appendChild(menuBtn);

    // Insertar en el día del calendario
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
      error: (err) => this.showMessage('Error loading dishes for the day.', 'error')
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
        this.showMessage('Dishes successfully assigned.', 'success');
        this.loadCalendarData(); // reload data and force re-render
      },
      error: () => this.showMessage('Error saving assignments.', 'error')
    });
  }

  // --- Days (Block/Unblock) ---

  toggleDayBlock(day: DayInfo): void {
    const newState = !day.blocked;
    this.backendService.updateDayBlockStatus(day.id, newState).subscribe({
      next: (updatedDay) => {
        // Update the list for the calendar (to change button text)
        this.availableDaysFull = this.availableDaysFull.map(dI => dI.id === updatedDay.id ? updatedDay : dI);

        const action = newState ? 'blocked' : 'unblocked';
        this.showMessage(`Day ${updatedDay.date.split('T')[0]} successfully ${action}.`, 'success');

        // Force calendar re-render to update the button text across all cells
        if (this.calendarComponent) {
          this.zone.run(() => {
            this.calendarComponent.getApi().render();
          });
        }
      },
      error: (err) => {
        this.showMessage('Error changing day status. The change will revert.', 'error');
        console.error(err);
        // Important: If the API fails, reload data to revert the optimistic UI change
        this.loadCalendarData();
      }
    });
  }
}