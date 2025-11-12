import { Injectable } from '@angular/core';
import {
  CanActivate,
  ActivatedRouteSnapshot,
  RouterStateSnapshot,
  Router
} from '@angular/router';
import { Observable, map } from 'rxjs';
import { AuthService } from '../auth.service';

@Injectable({
  providedIn: 'root'
})
export class RoleGuard implements CanActivate {

  constructor(private authService: AuthService, private router: Router) { }

  canActivate(
    route: ActivatedRouteSnapshot,
    state: RouterStateSnapshot): Observable<boolean> {

    // 1. Obtener los roles esperados desde la configuración de la ruta
    const expectedRoles: string[] = route.data['roles'];

    return this.authService.getUserRole().pipe(
      map(userRole => {

        // 2. Verificar si el usuario está autenticado y tiene un rol
        if (!userRole) {
          // El usuario no tiene rol (no está logueado), redirigir a login
          this.router.navigate(['/login']);
          return false;
        }

        // 3. Verificar si el rol del usuario está en la lista de roles esperados
        // Usuario logueado pero rol no permitido
        if (expectedRoles && !expectedRoles.includes(userRole)) {
          this.router.navigate(['/login']);
          return false;
        }

        // Usuario logueado y con rol permitido
        return true;
      })
    );
  }
}