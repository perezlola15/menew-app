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
  availableDaysFull: { id: number; date: string }[] = [];

  calendarOptions: CalendarOptions = {
    plugins: [dayGridPlugin, interactionPlugin],
    initialView: 'dayGridMonth',
    headerToolbar: {
      left: 'prev,next today',
      center: 'title',
      right: ''
    },
    locale: esLocale, // Para que el calendario aparezca en español
    firstDay: 1, // Añadimos esta propiedad para que la semana empiece en lunes
    eventContent: function (arg) {
      // arg.event.title = "Menú: Primer / Segundo / Postre"
      const container = document.createElement('div');
      container.className = 'fc-custom-event';

      // Crear líneas separadas para cada plato
      const titleLines = arg.event.title.split(' / ');
      titleLines.forEach(line => {
        const div = document.createElement('div');
        div.innerText = line;
        container.appendChild(div);
      });

      return { domNodes: [container] };
    },
    editable: false,
    selectable: false,
    events: [] as EventInput[],
    dateClick: (arg) => { }, // lo manejamos con los botones
    dayCellDidMount: (arg) => { } // lo definimos en ngOnInit
  };

  constructor(
    private backendService: BackendService,
    private zone: NgZone,
    private dialog: MatDialog,
    @Inject(PLATFORM_ID) private platformId: Object
  ) { this.isBrowser = isPlatformBrowser(this.platformId); }

  ngOnInit(): void {
    if (isPlatformBrowser(this.platformId)) {
      // --- 1. Cargar platos ---
      this.backendService.getAvailableDishes().subscribe({
        next: dishes => {
          this.availableDishes = dishes;
          this.firstDishes = dishes.filter(d => d.category === 1);
          this.secondDishes = dishes.filter(d => d.category === 2);
          this.desserts = dishes.filter(d => d.category === 3);
        },
        error: err => console.error('Error cargando platos:', err)
      });

      // --- 2. Cargar días disponibles ---
      this.backendService.getAvailableDays().subscribe({
        next: async (days: { id: number; date: string }[]) => {
          this.zone.run(async () => {
            this.availableDaysFull = days;
            this.availableDays = days.map(d => d.date.split('T')[0]);

            // 🔥 Verificar qué días tienen platos
            const daysWithMenus: string[] = [];
            for (const day of days) {
              const dayStr = day.date.split('T')[0];
              try {
                const dishes = await this.backendService.getDishesForDay(day.id).toPromise();
                if (dishes && dishes.length > 0) {
                  daysWithMenus.push(dayStr);
                }
              } catch (err) {
                console.error(`Error comprobando platos para el día ${dayStr}:`, err);
              }
            }
            console.log('daysWithMenus', daysWithMenus);

            this.daysWithDishes = daysWithMenus;

            // Ahora que tenemos todo, re-renderizamos el calendario
            this.calendarOptions = {
              ...this.calendarOptions,
              dayCellDidMount: this.handleDayDidMount.bind(this)
            };
          });
        },
        error: err => console.error('Error cargando días disponibles:', err)
      });

      // --- 3. Cargar menús del cliente ---
      if (this.backendService.getToken()) {
        this.backendService.getClientMenus().subscribe({
          next: events => {
            this.calendarOptions = {
              ...this.calendarOptions,
              events: events as EventInput[]
            };
          },
          error: err => console.error('Error cargando menús del cliente:', err)
        });
      }

      // --- 4. Configurar dayCellDidMount para crear botones (si lo necesitas) ---
      this.calendarOptions.dayCellDidMount = this.handleDayDidMount?.bind(this);

      this.backendService.getAvailableDays().subscribe({
        next: (days: { id: number; date: string }[]) => {
          this.zone.run(() => {
            this.availableDaysFull = days; // guardamos toda la info
            this.availableDays = days.map(d => d.date.split('T')[0]); // solo fechas para mostrar botones
          });
        },
        error: (err: any) => console.error('Error cargando días:', err)
      });
    }
  }
  // --- Verifica si hay menú ya seleccionado ---
  isMenuSelected(dateStr: string): boolean {
    return (this.calendarOptions.events as EventInput[]).some(e => e.start === dateStr);
  }

  handleDateClick(dateStr: string) {
    // 1️⃣ Buscar el día por fecha
    const day = this.availableDaysFull.find(d => d.date.split('T')[0] === dateStr);
    if (!day) return;

    // 2️⃣ Pedir los platos de ese día
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
      error: (err: any) => console.error('Error cargando platos del día:', err)
    });
  }

  saveMenuFromDialog(selection: MenuSelectionPayload) {
    this.backendService.saveClientMenu(selection).subscribe({
      next: () => {
        const first = this.firstDishes.find(d => d.id === selection.firstDishId)?.name || 'N/A';
        const second = this.secondDishes.find(d => d.id === selection.secondDishId)?.name || 'N/A';
        const dessert = this.desserts.find(d => d.id === selection.dessertId)?.name || 'N/A';
        const title = `Primero: ${first} / Segundo: ${second} / Postre: ${dessert}`;

        // 1️⃣ Crear evento
        const newEvent: EventInput = { title, start: selection.day, allDay: true };

        // 2️⃣ Actualizar eventos del calendario
        const existingEvents = (this.calendarOptions.events as EventInput[])
          .filter(e => e.start !== selection.day);
        this.calendarOptions = { ...this.calendarOptions, events: [...existingEvents, newEvent] };

        // 3️⃣ Eliminar el botón "Añadir Menú" de esa celda
        this.removeAddMenuButton(selection.day);
      },
      error: err => {
        console.error('Error guardando menú:', err);
        // Puedes opcionalmente mostrar un alert o snackbar aquí si quieres
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
  // --- Añade botón en la celda del calendario ---
  handleDayDidMount(arg: any) {

    if (!this.daysWithDishes.length) {
      // espera 100ms y reintenta (simple debounce)
      setTimeout(() => this.handleDayDidMount(arg), 100);
      return;
    }
    // Obtener la fecha local correcta
    const date = arg.date;
    const dateStr = date.getFullYear() + '-' +
      String(date.getMonth() + 1).padStart(2, '0') + '-' +
      String(date.getDate()).padStart(2, '0');

    // Fecha de hoy en local
    const today = new Date();
    const todayStr = today.getFullYear() + '-' +
      String(today.getMonth() + 1).padStart(2, '0') + '-' +
      String(today.getDate()).padStart(2, '0');

    // Mostrar botón solo si es un día válido
    if (
      dateStr >= todayStr &&
      !this.isMenuSelected(dateStr) &&
      this.daysWithDishes.includes(dateStr)
    ) {
      const button = document.createElement('button');
      button.innerText = 'Añadir Menú';
      button.className = 'add-menu-btn';
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