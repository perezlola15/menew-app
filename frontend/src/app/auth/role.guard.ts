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

  constructor(private authService: AuthService, private router: Router) {}

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
        if (expectedRoles && expectedRoles.includes(userRole)) {
          // El rol es el correcto, PERMITIR el acceso
          return true;
        } else {
          // El rol NO es el correcto, redirigir a una página de acceso denegado (o login)
          // Se recomienda una página de "acceso denegado" en producción
          //this.router.navigate(['/login']); 
          this.router.navigate(['/404']);
          return false;
        }
      })
    );
  }
}