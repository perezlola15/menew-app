import { Component, OnInit, Inject, PLATFORM_ID, NgZone } from '@angular/core';
import { FullCalendarModule } from '@fullcalendar/angular';
import { CalendarOptions, EventInput } from '@fullcalendar/core';
import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin from '@fullcalendar/interaction';
import { isPlatformBrowser } from '@angular/common';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ViewChild } from '@angular/core';
import { FullCalendarComponent } from '@fullcalendar/angular';
import esLocale from '@fullcalendar/core/locales/es';
import timeGridPlugin from '@fullcalendar/timegrid';

import { MatDialog } from '@angular/material/dialog';
import { MenuFormDialogComponent, MenuFormData } from '../menu-form-dialog/menu-form-dialog.component';


import { BackendService, Dish, MenuSelectionPayload } from '../services/backend.service';

@Component({
  selector: 'app-calendar',
  standalone: true,
  imports: [FullCalendarModule, CommonModule, FormsModule],
  templateUrl: './calendar.component.html',
  styleUrls: ['./calendar.component.scss']
})
export class CalendarComponent implements OnInit {
  @ViewChild('fullcalendar') calendarComponent!: FullCalendarComponent;
  // --- Estado general ---
  showMenuModal: boolean = false;
  selectedDate: string | null = null;

  availableDishes: Dish[] = [];
  firstDishes: Dish[] = [];
  secondDishes: Dish[] = [];
  desserts: Dish[] = [];
  isBrowser = false;
  daysWithDishes: string[] = [];

  menuSelection: MenuSelectionPayload = {
    day: '',
    firstDishId: null,
    secondDishId: null,
    dessertId: null
  };

  // Días disponibles desde la tabla Days
  availableDays: string[] = [];
  availableDaysFull: { id: number; date: string; blocked: boolean }[] = [];

  calendarOptions: CalendarOptions = {
    plugins: [dayGridPlugin, interactionPlugin, timeGridPlugin],
    initialView: 'dayGridMonth',
    headerToolbar: {
      left: 'prev,next today',
      center: 'title',
      right: ''
    },
    locale: esLocale, // Para que el calendario aparezca en español
    firstDay: 1, // Añadimos esta propiedad para que la semana empiece en lunes
    eventContent: (arg) => {
      const container = document.createElement('div');
      container.className = 'fc-custom-event position-relative';

      // Crear líneas del menú
      const titleLines = arg.event.title.split(' / ');
      titleLines.forEach(line => {
        const div = document.createElement('div');
        div.innerText = line;
        container.appendChild(div);
      });
      // Obtener la fecha del evento
    const eventDate = arg.event.startStr;
    
    // Buscar si el día está bloqueado
    const dayInfo = this.availableDaysFull.find(
      d => d.date.split('T')[0] === eventDate
    );
    
    // Solo mostrar botón de eliminar si el día NO está bloqueado
    if (!dayInfo?.blocked) {
      const deleteBtn = document.createElement('span');
      deleteBtn.innerText = '✖';
      deleteBtn.style.position = 'absolute';
      deleteBtn.style.top = '-15px';
      deleteBtn.style.right = '4px';
      deleteBtn.style.cursor = 'pointer';
      deleteBtn.style.color = 'red';
      deleteBtn.style.fontWeight = 'bold';
      deleteBtn.style.fontSize = '16px';

      deleteBtn.onclick = (e) => {
        e.stopPropagation();
        this.zone.run(() => this.deleteMenu(arg.event));
      };

      container.appendChild(deleteBtn);
    }

      return { domNodes: [container] };
    },
    editable: false,
    selectable: false,
    events: [] as EventInput[],
    dateClick: (arg) => { }, // Lo manejamos con los botones
    dayCellDidMount: (arg) => this.handleDayDidMount(arg)
  };

  deleteMenu(event: any) {
    const date = event.startStr;
    const user = this.backendService.getCurrentUser();

    if (!user) {
      console.error('No user available');
      return;
    }

    if (!confirm(`¿Eliminar el menú del día ${date}?`)) return;

    this.backendService.deleteClientMenu(date, user.id).subscribe({
      next: () => {
        // Filtrar eventos quitando el eliminado
        const updated = (this.calendarOptions.events as EventInput[])
          .filter(e => e.start !== date);

        this.calendarOptions = {
          ...this.calendarOptions,
          events: updated
        };

        // Vuelve a aparecer el botón “Select menu”
        this.restoreAddMenuButtons();
      },
      error: err => console.error('Error al eliminar menú: ', err)
    });
  }

restoreAddMenuButtons() {
  const calendarEl = document.querySelector('full-calendar');
  if (!calendarEl) return;

  const todayStr = new Date().toISOString().split('T')[0];

  const dayCells = calendarEl.querySelectorAll('.fc-daygrid-day');
  dayCells.forEach(cell => {
    const cellDate = cell.getAttribute('data-date');
    if (!cellDate) return;

    // Solo si hay que añadir botón
    if (this.daysWithDishes.includes(cellDate) && !this.isMenuSelected(cellDate) && cellDate >= todayStr) {
      if (!cell.querySelector('.add-menu-btn')) {
        const btn = document.createElement('button');
        btn.className = 'add-menu-btn btn btn-success';
        btn.innerText = 'Select menu';
        btn.onclick = () => this.zone.run(() => this.handleDateClick(cellDate));
        const container = cell.querySelector('.fc-daygrid-day-events');
        if (container) container.appendChild(btn);
        else cell.appendChild(btn);
      }
    }
  });
}

  constructor(
    private backendService: BackendService,
    private zone: NgZone,
    private dialog: MatDialog,
    @Inject(PLATFORM_ID) private platformId: Object
  ) { this.isBrowser = isPlatformBrowser(this.platformId); }

  ngOnInit(): void {
    if (isPlatformBrowser(this.platformId)) {
      // 1. Cargar platos
      this.backendService.getAvailableDishes().subscribe({
        next: dishes => {
          this.availableDishes = dishes;
          this.firstDishes = dishes.filter(d => d.category === 1);
          this.secondDishes = dishes.filter(d => d.category === 2);
          this.desserts = dishes.filter(d => d.category === 3);
        },
        error: err => console.error('Error loading dishes:', err)
      });

      // 2. Cargar días disponibles 
      this.backendService.getAvailableDays().subscribe({
        next: async (days: { id: number; date: string; blocked: boolean }[]) => {
          this.zone.run(async () => {
            this.availableDaysFull = days;
            this.availableDays = days.map(d => d.date.split('T')[0]);
            console.log('Days', days);

            // Verifica qué días tienen platos
            const daysWithMenus: string[] = [];
            for (const day of days) {
              const dayStr = day.date.split('T')[0];
              try {
                const dishes = await this.backendService.getDishesForDay(day.id).toPromise();
                if (dishes && dishes.length > 0 && day.blocked == false) {
                  daysWithMenus.push(dayStr);
                }
              } catch (err) {
                console.error(`Error checking dishes for day ${dayStr}:`, err);
              }
            }
            console.log('daysWithMenus', daysWithMenus);

            this.daysWithDishes = daysWithMenus;

            // Re-renderizamos el calendario
            this.calendarOptions = {
              ...this.calendarOptions,
              dayCellDidMount: this.handleDayDidMount.bind(this)
            };
          });
        },
        error: err => console.error('Error loading available days:', err)
      });

      // 3. Cargar menús del cliente 
      if (this.backendService.getToken()) {
        this.backendService.getClientMenus().subscribe({
          next: events => {
            this.calendarOptions = {
              ...this.calendarOptions,
              events: events as EventInput[]
            };
          },
          error: err => console.error('Error loading client menus: ', err)
        });
      }

      // 4. Configurar dayCellDidMount para crear botones
      this.calendarOptions.dayCellDidMount = this.handleDayDidMount?.bind(this);

      this.backendService.getAvailableDays().subscribe({
        next: (days: { id: number; date: string; blocked: boolean }[]) => {
          this.zone.run(() => {
            this.availableDaysFull = days; // Guardamos toda la info
            this.availableDays = days.map(d => d.date.split('T')[0]);
          });
        },
        error: (err: any) => console.error('Error loading days: ', err)
      });
    }
  }
  // Verifica si hay menú ya seleccionado
  isMenuSelected(dateStr: string): boolean {
    return (this.calendarOptions.events as EventInput[]).some(e => e.start === dateStr);
  }

  handleDateClick(dateStr: string) {
    // Buscar el día por fecha
    const day = this.availableDaysFull.find(d => d.date.split('T')[0] === dateStr);
    if (!day) return;

    // Pedir los platos de ese día
    this.backendService.getDishesForDay(day.id).subscribe({
      next: (dishes: Dish[]) => {
        // Separar por categorías
        const firstDishes = dishes.filter(d => d.category === 1);
        const secondDishes = dishes.filter(d => d.category === 2);
        const desserts = dishes.filter(d => d.category === 3);

        // Abrir modal con los platos de ese día
        const dialogRef = this.dialog.open(MenuFormDialogComponent, {
          data: {
            date: dateStr,
            firstDishes,
            secondDishes,
            desserts
          } as MenuFormData,
          width: '400px'
        });

        dialogRef.afterClosed().subscribe((result: MenuSelectionPayload | undefined) => {
          if (result) this.saveMenuFromDialog(result);
        });
      },
      error: (err: any) => console.error('Error loading dishes of the day: ', err)
    });
  }

  saveMenuFromDialog(selection: MenuSelectionPayload) {
    this.backendService.saveClientMenu(selection).subscribe({
      next: () => {
        const first = this.firstDishes.find(d => d.id === selection.firstDishId)?.name || 'N/A';
        const second = this.secondDishes.find(d => d.id === selection.secondDishId)?.name || 'N/A';
        const dessert = this.desserts.find(d => d.id === selection.dessertId)?.name || 'N/A';
        const title = `First: ${first} / Second: ${second} / Dessert: ${dessert}`;

        // Crea evento
        const newEvent: EventInput = { title, start: selection.day, allDay: true };

        // Actualiza eventos del calendario
        const existingEvents = (this.calendarOptions.events as EventInput[])
          .filter(e => e.start !== selection.day);
        this.calendarOptions = { ...this.calendarOptions, events: [...existingEvents, newEvent] };

        // Elimina el botón "Añadir Menú" de esa celda
        this.removeAddMenuButton(selection.day);
      },
      error: err => {
        console.error('Error saving menu: ', err);
      }
    });
  }

  // Función para quitar el botón del día correspondiente
  removeAddMenuButton(dayStr: string) {
    const calendarEl = document.querySelector('full-calendar');
    if (!calendarEl) return;

    const dayCells = calendarEl.querySelectorAll('.fc-daygrid-day');
    dayCells.forEach(cell => {
      const cellDate = cell.getAttribute('data-date');
      if (cellDate === dayStr) {
        const btn = cell.querySelector<HTMLButtonElement>('.add-menu-btn');
        if (btn) btn.remove();
      }
    });
  }

  // Añade botón en la celda del calendario
  handleDayDidMount(arg: any) {

    if (!this.daysWithDishes.length) {
      setTimeout(() => this.handleDayDidMount(arg), 100);
      return;
    }

    const date = arg.date;
    const dateStr = date.getFullYear() + '-' +
      String(date.getMonth() + 1).padStart(2, '0') + '-' +
      String(date.getDate()).padStart(2, '0');

    const today = new Date();
    const todayStr = today.getFullYear() + '-' +
      String(today.getMonth() + 1).padStart(2, '0') + '-' +
      String(today.getDate()).padStart(2, '0');

    // 🔥 Buscar info completa del día
    const dayInfo = this.availableDaysFull.find(
      d => d.date.split('T')[0] === dateStr
    );

    // 🔥 Si el día está bloqueado → mostrar aviso y salir
    if (dayInfo?.blocked) {
      const container = arg.el.querySelector('.fc-daygrid-day-events');

      const blockedMsg = document.createElement('div');
      blockedMsg.innerText = 'Día bloqueado: no se pueden añadir más menús.';
      blockedMsg.className = 'text-danger fw-bold small text-center';

      if (container) container.appendChild(blockedMsg);
      else arg.el.appendChild(blockedMsg);

      return;
    }

    // 🔥 Mostrar botón solo si NO está bloqueado y cumple las demás condiciones
    if (
      dateStr >= todayStr &&
      !this.isMenuSelected(dateStr) &&
      this.daysWithDishes.includes(dateStr)
    ) {
      const button = document.createElement('button');
      button.innerText = 'Select menu';
      button.className = 'add-menu-btn btn btn-success';
      button.onclick = () => this.zone.run(() => this.handleDateClick(dateStr));

      const container = arg.el.querySelector('.fc-daygrid-day-events');
      if (container) container.appendChild(button);
      else arg.el.appendChild(button);
    }
  }

  closeMenuModal(): void {
    this.showMenuModal = false;
    this.selectedDate = null;
    this.menuSelection = { day: '', firstDishId: null, secondDishId: null, dessertId: null };
  }
}