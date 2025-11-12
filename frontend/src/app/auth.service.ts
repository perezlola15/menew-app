import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Observable, of } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  constructor(@Inject(PLATFORM_ID) private platformId: Object) {}

  private isBrowser(): boolean {
    return isPlatformBrowser(this.platformId);
  }

  public login(role: string): void {
    if (this.isBrowser()) {
      localStorage.setItem('userRole', role);
    }
  }

  public logout(): void {
    if (this.isBrowser()) {
      localStorage.removeItem('userRole');
    }
  }

  public getUserRole(): Observable<string | null> {
    if (this.isBrowser()) {
      const role = localStorage.getItem('userRole');
      return of(role);
    }
    // Si no estamos en navegador, devolvemos null
    return of(null);
  }

  public isAuthenticated(): boolean {
    return this.isBrowser() && !!localStorage.getItem('userRole');
  }
}
