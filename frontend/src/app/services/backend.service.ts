import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { tap } from 'rxjs/operators';
import { Observable } from 'rxjs';

interface LoginResponse {
  token: string;
  user: {
    id: number;
    email: string;
    role: 'admin' | 'client';
  };
}

@Injectable({ providedIn: 'root' })
export class BackendService {
  private baseUrl = 'http://localhost:3000';
  private token: string | null = null;

  constructor(private http: HttpClient) {}

  login(email: string, password: string): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(`${this.baseUrl}/login`, { email, password }).pipe(
      tap(res => this.token = res.token)
    );
  }

  getToken() {
    return this.token;
  }
}
