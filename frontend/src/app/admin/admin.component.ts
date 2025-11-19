import { Component, OnInit, signal, computed, inject } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { BackendService, DayInfo } from '../services/backend.service';
import { FullCalendarModule } from '@fullcalendar/angular';
import { FullCalendarComponent } from '@fullcalendar/angular';
import { of } from 'rxjs';

import { CalendarOptions } from '@fullcalendar/core';
import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin from '@fullcalendar/interaction';
import esLocale from '@fullcalendar/core/locales/es';
import { MatDialog } from '@angular/material/dialog';
import { ViewChild, NgZone, Inject, PLATFORM_ID } from '@angular/core';
import { MenuFormDialogAdminComponent, MenuFormAdminData } from '../menu-form-dialog-admin/menu-form-dialog-admin.component';


@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [CommonModule, FormsModule, FullCalendarModule],
  templateUrl: './admin.component.html',
  styleUrl: './admin.component.scss'
})
export class AdminComponent implements OnInit {
  @ViewChild('fullcalendar') calendarComponent!: FullCalendarComponent;

  calendarOptions: CalendarOptions; 

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

    this.calendarOptions = {
      plugins: [dayGridPlugin, interactionPlugin],
      initialView: 'dayGridMonth',
      // locale: esLocale,
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
    if (this.availableDaysFull.length === 0) {
      setTimeout(() => this.handleDayDidMount(arg), 100);
      return;
    }

    const date = arg.date;
    const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    const container = arg.el.querySelector('.fc-daygrid-day-events');

    // Buscar si el día existe ya en la base de datos
    const day = this.availableDaysFull.find(d => d.date.startsWith(dateStr));

    // Crear contenedor de botones
    const wrapper = document.createElement('div');
    wrapper.className = 'd-flex flex-column gap-1 p-1';

    // --- Botón Bloquear / Desbloquear (solo si el día existe) ---
    let btnTextDishes = 'Añadir platos'
    let btnClassDishes = 'btn btn-primary w-100'


    if (day) {
      btnTextDishes = "Modificar platos"
      btnClassDishes = 'btn btn-info w-100'
      const blockBtn = document.createElement('button');
      blockBtn.innerText = day.blocked ? 'Desbloquear' : 'Bloquear';
      blockBtn.className = `btn ${day.blocked ? 'btn-warning' : 'btn-danger'}`;

      blockBtn.onclick = () => this.zone.run(() => {
        const latestDay = this.availableDaysFull.find(d => d.id === day.id);
        if (!latestDay) return;

        const newBlockedState = !latestDay.blocked;
        blockBtn.innerText = newBlockedState ? 'Desbloquear' : 'Bloquear';
        blockBtn.classList.toggle('btn-danger', !newBlockedState);
        blockBtn.classList.toggle('btn-warning', newBlockedState);

        this.toggleDayBlock(latestDay);
      });

      wrapper.appendChild(blockBtn);
    }

    // --- Botón Asignar Platos (siempre visible) ---
    const menuBtn = document.createElement('button');
    menuBtn.innerText = btnTextDishes;
    menuBtn.className = btnClassDishes;
    menuBtn.onclick = () => this.zone.run(() => {
      if (day) {
        // Día ya existe → abrir diálogo normal
        this.openAssignMenuDialog(day);
      } else {
        // Día no existe → abrir diálogo “nuevo día”
        this.openAssignMenuDialog({
          id: 0, // marcador temporal
          date: dateStr,
          blocked: false,
        } as DayInfo);
      }
    });

    wrapper.appendChild(menuBtn);

    if (container) container.appendChild(wrapper);
  }


  openAssignMenuDialog(day: DayInfo | { date: string; id: number }): void {
    const date = day.date.split('T')[0];

    // Primero obtenemos todos los platos y los ya asignados (si el día existe)
    this.backendService.getAvailableDishes().subscribe({
      next: (allDishes) => {
        const assignedIds$ = day.id
          ? this.backendService.getDishesForDay(day.id)
          : of([]); // si no existe, ninguno asignado
        assignedIds$.subscribe({
          next: (assigned) => {
            const assignedIds = assigned.map((a: any) => a.id);

            const dialogRef = this.dialog.open(MenuFormDialogAdminComponent, {
              width: '600px',
              data: {
                date,
                dayId: day.id,
                allDishes,
                assignedDishIds: assignedIds,
              },
            });

            dialogRef.afterClosed().subscribe((result) => {
              if (result) this.saveDayDishesFromDialog(day.id, result);
            });
          },
          error: () =>
            this.showMessage('Error al cargar los platos del día.', 'error'),
        });
      },
      error: () => this.showMessage('Error al cargar todos los platos.', 'error'),
    });
  }


  saveDayDishesFromDialog(dayId: number, result: any): void {
    const dishIds = result.dishIds;

    // Si el día aún no existe, primero crearlo
    if (dayId === 0) {
      this.backendService.createDay(result.date).subscribe({
        next: (newDay) => {
          this.backendService.updateDayDishes(newDay.id, dishIds).subscribe({
            next: () => {
              this.showMessage('Día creado y platos asignados correctamente.', 'success');
              this.loadCalendarData();
              setTimeout(() => this.forceCalendarRefresh(), 50);
            },
            error: () => this.showMessage('Error al asignar platos tras crear el día.', 'error')
          });
        },
        error: () => this.showMessage('Error al crear el nuevo día.', 'error')
      });
      return;
    }

    // Día ya existe: solo actualizar platos
    this.backendService.updateDayDishes(dayId, dishIds).subscribe({
      next: () => {
        this.showMessage('Platos asignados correctamente.', 'success');
        this.loadCalendarData();
        setTimeout(() => this.forceCalendarRefresh(), 50);
      },
      error: () => this.showMessage('Error al guardar los platos.', 'error')
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
  forceCalendarRefresh() {
    if (!this.calendarComponent) return;

    const api = this.calendarComponent.getApi();

    const currentView = api.view.type;
    const currentDate = api.getDate();

    const scrollY = window.scrollY;

    // Cambiar a otra vista
    api.changeView('dayGridWeek');

    setTimeout(() => {
      api.changeView(currentView);
      api.gotoDate(currentDate);

      window.scrollTo({
        top: scrollY,
        left: 0,
        behavior: 'auto'
      });
    }, 50);
  }

}