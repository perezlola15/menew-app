import { Injectable } from '@angular/core';
import { CanActivate, Router } from '@angular/router';
import { first } from 'rxjs/operators';
import { AuthService } from '../auth.service';

@Injectable({
  providedIn: 'root'
})
export class WildcardGuard implements CanActivate {

  constructor(private authService: AuthService, private router: Router) {}

  canActivate(): boolean {
    if (!this.authService.isAuthenticated()) {
      // Si un usuario no está logueado, redirige a /login
      this.router.navigate(['/login']);
    } else {
      // Si el usuario está logueado, redirige según el rol
      this.authService.getUserRole().pipe(first()).subscribe(role => {
        if (role === 'admin') {
          this.router.navigate(['/admin']);
        } else if (role === 'client') {
          this.router.navigate(['/calendar']);
        } else {
          // Por si hay rol inválido
          this.router.navigate(['/login']);
        }
      });
    }

    // Nunca permite acceder a la ruta inválida
    return false; 
  }
}
