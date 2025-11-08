import { Injectable, PLATFORM_ID, Inject } from '@angular/core'; // <-- 1. Importaciones necesarias
import { HttpClient } from '@angular/common/http';
import { isPlatformBrowser } from '@angular/common'; // <-- 2. Función de chequeo
import { tap } from 'rxjs/operators';
import { Observable } from 'rxjs';

// --- Interfaces (Dejamos tus interfaces sin cambios) ---
interface LoginResponse {
  token: string;
  user: {
    id: number;
    email: string;
    role: 'admin' | 'client';
  };
}

export interface Dish {
  id: number;
  name: string;
  category: number; // 1: Primer Plato, 2: Segundo Plato, 3: Postre
}

export interface DayMenuEvent {
  title: string;
  start: string;
  allDay: boolean;
  extendedProps: {
    firstDishId: number;
    secondDishId: number;
    dessertId: number;
  };
}

export interface DayCheckResponse {
  date: string;
  hasDishes: boolean;
}

export interface MenuSelectionPayload {
  day: string;
  firstDishId: number | null;
  secondDishId: number | null;
  dessertId: number | null;
}
// --- Fin de Interfaces ---


@Injectable({ providedIn: 'root' })
export class BackendService {
  private baseUrl = 'http://localhost:3000';
  private token: string | null = null;
  private readonly TOKEN_KEY = 'auth_token'; 
  private isBrowser: boolean; // Propiedad para verificar el entorno

  constructor(
    private http: HttpClient,
    // 3. Inyectar PLATFORM_ID
    @Inject(PLATFORM_ID) private platformId: Object 
  ) {
    // 4. Chequeamos si estamos en el navegador
    this.isBrowser = isPlatformBrowser(this.platformId);

    // 5. SOLO leemos localStorage si estamos en el navegador
    if (this.isBrowser) { 
      this.token = localStorage.getItem(this.TOKEN_KEY);
    }
  }

  // --- MÉTODOS DE AUTENTICACIÓN (Modificados para ser seguros) ---

  login(email: string, password: string): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(`${this.baseUrl}/login`, { email, password }).pipe(
      tap(res => {
        this.token = res.token;
        // Solo guardamos si estamos en el navegador
        if (this.isBrowser) {
          localStorage.setItem(this.TOKEN_KEY, res.token); 
        }
      })
    );
  }

  logout() {
    this.token = null;
    // Solo eliminamos si estamos en el navegador
    if (this.isBrowser) {
      localStorage.removeItem(this.TOKEN_KEY);
    }
  }
  
  // El resto de tus métodos (getToken(), getAvailableDishes(), etc.) permanecen igual
  // ya que no acceden directamente a localStorage.
  
  getToken() {
    return this.token;
  }

  // --- MÉTODOS DE DATOS DEL CALENDARIO ---

  getAvailableDishes(): Observable<Dish[]> {
    return this.http.get<Dish[]>(`${this.baseUrl}/dishes`);
  }

  getClientMenus(): Observable<DayMenuEvent[]> {
    return this.http.get<DayMenuEvent[]>(`${this.baseUrl}/client/menus`);
  }

  checkDayDishes(date: string): Observable<DayCheckResponse> {
    return this.http.get<DayCheckResponse>(`${this.baseUrl}/days/check-dishes?date=${date}`);
  }

  saveClientMenu(menu: MenuSelectionPayload): Observable<any> {
    return this.http.post(`${this.baseUrl}/client/menus`, menu);
  }

  getAvailableDays(): Observable<{ date: string }[]> {
    return this.http.get<{ date: string }[]>(`${this.baseUrl}/days`);
  }
}