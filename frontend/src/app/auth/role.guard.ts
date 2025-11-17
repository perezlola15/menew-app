import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import {
  CanActivate,
  ActivatedRouteSnapshot,
  RouterStateSnapshot,
  Router
} from '@angular/router';
import { Observable, map, of } from 'rxjs';
import { AuthService } from '../auth.service';
import { isPlatformBrowser } from '@angular/common';

@Injectable({
  providedIn: 'root'
})
export class RoleGuard implements CanActivate {

  constructor(
    private authService: AuthService, 
    private router: Router,
    @Inject(PLATFORM_ID) private platformId: any
  ) { }

  canActivate(
    route: ActivatedRouteSnapshot,
    state: RouterStateSnapshot): Observable<boolean> {

    const expectedRoles: string[] = route.data['roles'];

    // SOLO esta verificación para SSR
    if (!isPlatformBrowser(this.platformId)) {
      // En SSR, NO renderizar componentes protegidos
      return of(false); // ← Cambia esto a false
    }

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