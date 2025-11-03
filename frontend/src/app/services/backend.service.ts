import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';

interface User {
  id: number;
  email: string;
  role: string;
}

interface LoginResponse {
  token: string;
  user: User;
}

interface Dish {
  id: number;
  name: string;
  category: number;
}

interface Day {
  id: number;
  date: string;
  blocked: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class BackendService {

  private baseUrl = 'http://localhost:3000'; // Ajusta si tu backend está en otro host/puerto
  private token: string | null = null;

  constructor(private http: HttpClient) {}

  // Login
  login(email: string, password: string): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(`${this.baseUrl}/login`, { email, password });
  }

  // Guardar token recibido tras login
  setToken(token: string) {
    this.token = token;
  }

  // Headers con token
  private getAuthHeaders(): HttpHeaders {
    return new HttpHeaders({
      'Authorization': `Bearer ${this.token}`
    });
  }

  // Obtener todos los platos
  getDishes(): Observable<Dish[]> {
    return this.http.get<Dish[]>(`${this.baseUrl}/dishes`, { headers: this.getAuthHeaders() });
  }

  // Obtener todos los días
  getDays(): Observable<Day[]> {
    return this.http.get<Day[]>(`${this.baseUrl}/days`, { headers: this.getAuthHeaders() });
  }

  // Obtener platos de un día concreto
  getDayDishes(dayId: number): Observable<Dish[]> {
    return this.http.get<Dish[]>(`${this.baseUrl}/day/${dayId}/dishes`, { headers: this.getAuthHeaders() });
  }
}
