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

  // DayInfo estado
  days = signal<DayInfo[]>([]);

  // Mensaje general
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
      dayCellDidMount: this.handleDayDidMount.bind(this),
      editable: false,
      selectable: false,
      events: [],
    };
  }

  ngOnInit(): void {
    if (this.isBrowser) {
      this.loadCalendarData();
    }
  }

  // Helper
  showMessage(text: string, type: 'success' | 'error'): void {
    this.message.set({ text, type });
    setTimeout(() => this.message.set(null), 5000);
  }

  // Calendario
  loadCalendarData(): void {
    // Cargar los días disponibles
    this.backendService.getAvailableDays().subscribe({
      next: (days) => {
        this.availableDaysFull = days;
        this.days.set(days);

        if (this.calendarComponent) {
          this.zone.run(() => {
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

    // Botón Bloquear / Desbloquear (solo si el día existe)
    let btnTextDishes = 'Add dishes'
    let btnClassDishes = 'btn btn-primary w-100'


    if (day) {
      btnTextDishes = "Edit dishes"
      btnClassDishes = 'btn btn-info w-100'
      const blockBtn = document.createElement('button');
      blockBtn.innerText = day.blocked ? 'Unlock' : 'Lock';
      blockBtn.className = `btn ${day.blocked ? 'btn-warning' : 'btn-danger'}`;

      blockBtn.onclick = () => this.zone.run(() => {
        const latestDay = this.availableDaysFull.find(d => d.id === day.id);
        if (!latestDay) return;

        const newBlockedState = !latestDay.blocked;
        blockBtn.innerText = newBlockedState ? 'Unlock' : 'Lock';
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
        // Si día ya existe, abrir diálogo normal
        this.openAssignMenuDialog(day);
      } else {
        // Si día no existe, abrir diálogo "nuevo día"
        this.openAssignMenuDialog({
          id: 0,
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
            this.showMessage('Error while loading today’s dishes.', 'error'),
        });
      },
      error: () => this.showMessage('Error while loading all dishes.', 'error'),
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
              this.showMessage('Day created and dishes assigned successfully.', 'success');
              this.loadCalendarData();
              setTimeout(() => this.forceCalendarRefresh(), 50);
            },
            error: () => this.showMessage('Error while assigning dishes after the day was created.', 'error')
          });
        },
        error: () => this.showMessage('Error while creating the new day.', 'error')
      });
      return;
    }

    // Día ya existe: solo actualizar platos
    this.backendService.updateDayDishes(dayId, dishIds).subscribe({
      next: () => {
        this.showMessage('Dishes assigned successfully.', 'success');
        this.loadCalendarData();
        setTimeout(() => this.forceCalendarRefresh(), 50);
      },
      error: () => this.showMessage('Error saving the dishes.', 'error')
    });
  }

  // Days (Lock/Unlock) 
  toggleDayBlock(day: DayInfo): void {
    const newState = !day.blocked;
    this.backendService.updateDayBlockStatus(day.id, newState).subscribe({
      next: (updatedDay) => {
        this.availableDaysFull = this.availableDaysFull.map(dI => dI.id === updatedDay.id ? updatedDay : dI);

        const action = newState ? 'blocked' : 'unblocked';
        this.showMessage(`Day ${updatedDay.date.split('T')[0]} successfully ${action}.`, 'success');

        if (this.calendarComponent) {
          this.zone.run(() => {
            this.calendarComponent.getApi().render();
          });
        }
      },
      error: (err) => {
        this.showMessage('Error changing day status. The change will revert.', 'error');
        console.error(err);
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