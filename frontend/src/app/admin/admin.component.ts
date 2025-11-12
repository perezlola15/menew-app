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

        // FIX: Force re-render of the current view after data is available
        // This makes sure dayCellDidMount is called for the current month with the available data.
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

    // FIX: Implement the retry/polling mechanism if data hasn't loaded yet
    if (this.availableDaysFull.length === 0) {
      // Data not yet loaded from API. Wait 100ms and retry the mount process.
      setTimeout(() => this.handleDayDidMount(arg), 100);
      return;
    }
    const date = arg.date;
    const dateStr = date.toISOString().split('T')[0];
    const container = arg.el.querySelector('.fc-daygrid-day-events');

    // Find the day
    const day = this.availableDaysFull.find(d => d.date.startsWith(dateStr));
    if (!day) return;

    // Create container
    const wrapper = document.createElement('div');
    wrapper.className = 'flex flex-col space-y-1 p-1';

    // Block/Unblock button
    const blockBtn = document.createElement('button');
    blockBtn.innerText = day.blocked ? 'Unblock' : 'Block';
    blockBtn.className = `text-xs px-2 py-1 rounded ${day.blocked ? 'bg-yellow-500 text-white' : 'bg-red-500 text-white'}`;
    // Use Angular zone to update state after DOM event
    blockBtn.onclick = () => this.zone.run(() => this.toggleDayBlock(day)); 

    // Assign Dishes button
    const menuBtn = document.createElement('button');
    menuBtn.innerText = 'Assign Dishes';
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
        this.showMessage('Error changing day status.', 'error');
        console.error(err);
      }
    });
  }
}