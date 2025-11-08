import { Component, OnInit, Inject, PLATFORM_ID, NgZone } from '@angular/core';
import { FullCalendarModule } from '@fullcalendar/angular';
import { CalendarOptions, EventInput } from '@fullcalendar/core';
import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin from '@fullcalendar/interaction';
import { isPlatformBrowser } from '@angular/common';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { MatDialog } from '@angular/material/dialog';
import { MenuFormDialogComponent, MenuFormData } from '../menu-form-dialog/menu-form-dialog.component';


import { BackendService, Dish, MenuSelectionPayload, DayCheckResponse, DayMenuEvent } from '../services/backend.service';

@Component({
  selector: 'app-calendar',
  standalone: true,
  imports: [FullCalendarModule, CommonModule, FormsModule],
  templateUrl: './calendar.component.html',
  styleUrls: ['./calendar.component.scss']
})
export class CalendarComponent implements OnInit {

  // --- Estado general ---
  showMenuModal: boolean = false;
  selectedDate: string | null = null;

  availableDishes: Dish[] = [];
  firstDishes: Dish[] = [];
  secondDishes: Dish[] = [];
  desserts: Dish[] = [];
  isBrowser = false;

  menuSelection: MenuSelectionPayload = {
    day: '',
    firstDishId: null,
    secondDishId: null,
    dessertId: null
  };

  // Días disponibles desde la tabla Days
  availableDays: string[] = [];

  calendarOptions: CalendarOptions = {
    plugins: [dayGridPlugin, interactionPlugin],
    initialView: 'dayGridMonth',
    headerToolbar: {
      left: 'prev,next today',
      center: 'title',
      right: 'dayGridMonth'
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
        next: days => {
          this.zone.run(() => {
            this.availableDays = days.map(d => d.date.split('T')[0]);
            console.log('Días disponibles:', this.availableDays);
          });
        },
        error: err => console.error('Error cargando días:', err)
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
    }
  }
  // --- Verifica si hay menú ya seleccionado ---
  isMenuSelected(dateStr: string): boolean {
    return (this.calendarOptions.events as EventInput[]).some(e => e.start === dateStr);
  }

  handleDateClick(dateStr: string) {
    
    this.backendService.checkDayDishes(dateStr).subscribe({
      next: res => {
        if (res.hasDishes) {
          // Abrir modal Angular Material
          const dialogRef = this.dialog.open(MenuFormDialogComponent, {
            data: {
              date: dateStr,
              firstDishes: this.firstDishes,
              secondDishes: this.secondDishes,
              desserts: this.desserts
            } as MenuFormData,
            width: '400px'
          });

          dialogRef.afterClosed().subscribe((result: MenuSelectionPayload | undefined) => {
            if (result) {
              // El usuario guardó el menú
              this.saveMenuFromDialog(result);
            }
          });

        } else {
          alert('⚠️ Aún no hay menú disponible para ' + dateStr);
        }
      }
    });
  }

  saveMenuFromDialog(selection: MenuSelectionPayload) {
    this.backendService.saveClientMenu(selection).subscribe({
      next: () => {
        const first = this.firstDishes.find(d => d.id === selection.firstDishId)?.name || 'N/A';
        const second = this.secondDishes.find(d => d.id === selection.secondDishId)?.name || 'N/A';
        const title = `Menú: ${first} / ${second}`;

        const newEvent: EventInput = { title, start: selection.day, allDay: true };
        const existingEvents = (this.calendarOptions.events as EventInput[]).filter(e => e.start !== selection.day);
        this.calendarOptions = { ...this.calendarOptions, events: [...existingEvents, newEvent] };

        alert('✅ Menú guardado con éxito!');
      },
      error: err => {
        console.error('Error guardando menú:', err);
        alert('❌ No se pudo guardar el menú');
      }
    });
  }
  // --- Añade botón en la celda del calendario ---
handleDayDidMount(arg: any) {
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

  console.log('arg', arg);
  console.log('dateStr', dateStr);

  // Mostrar botón solo si es un día válido
  if (dateStr >= todayStr &&
      !this.isMenuSelected(dateStr) &&
      this.availableDays.includes(dateStr)) {

    const button = document.createElement('button');
    button.innerText = 'Añadir Menú';
    button.className = 'add-menu-btn';
    button.onclick = () => this.zone.run(() => this.handleDateClick(dateStr));

    const container = arg.el.querySelector('.fc-daygrid-day-events');
    if (container) container.appendChild(button);
    else arg.el.appendChild(button);
  }
}

  // --- Guardar menú seleccionado ---
  saveMenu(): void {
    const { day, firstDishId, secondDishId, dessertId } = this.menuSelection;

    if (!firstDishId || !secondDishId || !dessertId) {
      alert('Selecciona un plato de cada categoría');
      return;
    }

    const payload: MenuSelectionPayload = { day, firstDishId, secondDishId, dessertId };

    this.backendService.saveClientMenu(payload).subscribe({
      next: () => {
        const first = this.firstDishes.find(d => d.id === firstDishId)?.name || 'N/A';
        const second = this.secondDishes.find(d => d.id === secondDishId)?.name || 'N/A';
        const title = `Menú: ${first} / ${second}`;

        const newEvent: EventInput = { title, start: day, allDay: true, extendedProps: { firstDishId, secondDishId, dessertId } };
        const existingEvents = (this.calendarOptions.events as EventInput[]).filter(e => e.start !== day);

        this.calendarOptions = { ...this.calendarOptions, events: [...existingEvents, newEvent] };
        this.closeMenuModal();
        alert('✅ Menú guardado con éxito!');
      },
      error: err => {
        console.error('Error guardando menú:', err);
        alert('❌ No se pudo guardar el menú');
      }
    });
  }

  closeMenuModal(): void {
    this.showMenuModal = false;
    this.selectedDate = null;
    this.menuSelection = { day: '', firstDishId: null, secondDishId: null, dessertId: null };
  }
}
