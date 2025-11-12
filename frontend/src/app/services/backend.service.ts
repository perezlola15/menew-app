import { Injectable, PLATFORM_ID, Inject } from '@angular/core'; // <-- 1. Importaciones necesarias
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { isPlatformBrowser } from '@angular/common'; // <-- 2. Función de chequeo
import { tap } from 'rxjs/operators';
import { BehaviorSubject, Observable } from 'rxjs';

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

export interface DayInfo {
  id: number;
  date: string;
  blocked: boolean;
}

export interface DayDishStatus extends Dish {
  is_assigned: boolean;
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

export interface MenuSelectionPayload {
  day: string;
  firstDishId: number | null;
  secondDishId: number | null;
  dessertId: number | null;
}

// NUEVA INTERFACE PARA USUARIO (Igual que el user de LoginResponse, pero exportable)
export interface User {
  id: number;
  email: string;
  role: 'admin' | 'client';
}

export interface UserForm {
  email: string;
  password?: string; // Opcional para editar
  role: 'admin' | 'client';
}
// --- Fin de Interfaces ---


@Injectable({ providedIn: 'root' })
export class BackendService {
  private baseUrl = 'http://localhost:3000';
  private token: string | null = null;
  private readonly TOKEN_KEY = 'auth_token';
  private isBrowser: boolean; // Propiedad para verificar el entorno

  // Estado global del usuario logueado
  private userSubject = new BehaviorSubject<LoginResponse['user'] | null>(null);
  user$ = this.userSubject.asObservable();

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
      const storedUser = localStorage.getItem('auth_user');
      if (storedUser) this.userSubject.next(JSON.parse(storedUser));
    }
  }

  private getHeaders(): HttpHeaders {
    return new HttpHeaders({
      'Authorization': `Bearer ${this.token}`
    });
  }

  // --- MÉTODOS DE AUTENTICACIÓN (Modificados para ser seguros) ---
  login(email: string, password: string): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(`${this.baseUrl}/login`, { email, password }).pipe(
      tap(res => {
        this.token = res.token;
        // Solo guardamos si estamos en el navegador
        if (this.isBrowser) {
          localStorage.setItem(this.TOKEN_KEY, res.token);
          localStorage.setItem('auth_user', JSON.stringify(res.user)); // Guardamos el usuario

          // Actualizamos el BehaviorSubject para que Navbar y otros componentes lo vean
          this.userSubject.next(res.user);
        }
      })
    );
  }

  logout() {
    this.token = null;
    this.userSubject.next(null); // Limpia el usuario
    if (this.isBrowser) {
      localStorage.removeItem(this.TOKEN_KEY);
      localStorage.removeItem('auth_user');
    }
  }

  // El resto de tus métodos (getToken(), getAvailableDishes(), etc.) permanecen igual
  // ya que no acceden directamente a localStorage.

  getToken() {
    return this.token;
  }

  // --- MÉTODOS PÚBLICOS Y DE CLIENTE ---
  getAvailableDishes(): Observable<Dish[]> {
    return this.http.get<Dish[]>(`${this.baseUrl}/dishes`);
  }
  getDishesForDay(dayId: number): Observable<Dish[]> {
    return this.http.get<Dish[]>(`${this.baseUrl}/day/${dayId}/dishes`);
  }
  getClientMenus(): Observable<DayMenuEvent[]> {
    return this.http.get<DayMenuEvent[]>(`${this.baseUrl}/client/menus`, { headers: this.getHeaders() });
  }
  saveClientMenu(menu: MenuSelectionPayload): Observable<any> {
    return this.http.post(`${this.baseUrl}/client/menus`, menu, { headers: this.getHeaders() });
  }
  getAvailableDays(): Observable<DayInfo[]> {
    // Usamos DayInfo[] ya que la ruta protegida devuelve toda la info
    return this.http.get<DayInfo[]>(`${this.baseUrl}/days`, { headers: this.getHeaders() });
  }

  // --- NUEVOS MÉTODOS DE ADMINISTRACIÓN ---

  // Platos (CRUD)
  addDish(dish: { name: string, category: number }): Observable<Dish> {
    return this.http.post<Dish>(`${this.baseUrl}/admin/dishes`, dish, { headers: this.getHeaders() });
  }

  updateDish(id: number, dish: { name: string, category: number }): Observable<Dish> {
    return this.http.put<Dish>(`${this.baseUrl}/admin/dishes/${id}`, dish, { headers: this.getHeaders() });
  }

  deleteDish(id: number): Observable<{ message: string, id: number }> {
    return this.http.delete<{ message: string, id: number }>(`${this.baseUrl}/admin/dishes/${id}`, { headers: this.getHeaders() });
  }

  // Días (Bloqueo/Desbloqueo)
  updateDayBlockStatus(id: number, blocked: boolean): Observable<DayInfo> {
    return this.http.put<DayInfo>(`${this.baseUrl}/admin/days/${id}/block`, { blocked }, { headers: this.getHeaders() });
  }

  // Días-Platos (Asignación)
  getDayDishStatus(dayId: number): Observable<DayDishStatus[]> {
    return this.http.get<DayDishStatus[]>(`${this.baseUrl}/admin/day-dishes/${dayId}`, { headers: this.getHeaders() });
  }

  updateDayDishes(dayId: number, dishIds: number[]): Observable<{ message: string, assigned: number }> {
    return this.http.post<{ message: string, assigned: number }>(
      `${this.baseUrl}/admin/day-dishes/${dayId}`,
      { dishIds },
      { headers: this.getHeaders() }
    );
  }

  // --- NUEVOS MÉTODOS DE ADMINISTRACIÓN DE USUARIOS (CRUD) ---

  // GET /admin/users - Obtener todos los usuarios
  getUsers(): Observable<User[]> {
    return this.http.get<User[]>(`${this.baseUrl}/admin/users`, { headers: this.getHeaders() });
  }

  // POST /admin/users - Crear nuevo usuario
  addUser(user: UserForm): Observable<User> {
    return this.http.post<User>(`${this.baseUrl}/admin/users`, user, { headers: this.getHeaders() });
  }
  
  // PUT /admin/users/:id - Actualizar usuario
  updateUser(id: number, user: { email: string, role: 'admin' | 'client' }): Observable<User> {
    return this.http.put<User>(`${this.baseUrl}/admin/users/${id}`, user, { headers: this.getHeaders() });
  }

  // DELETE /admin/users/:id - Eliminar usuario
  deleteUser(id: number): Observable<{ message: string, id: number }> {
    return this.http.delete<{ message: string, id: number }>(`${this.baseUrl}/admin/users/${id}`, { headers: this.getHeaders() });
  }
}