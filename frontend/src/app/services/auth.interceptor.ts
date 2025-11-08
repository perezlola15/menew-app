import { Injectable } from '@angular/core';
import {
  HttpRequest,
  HttpHandler,
  HttpEvent,
  HttpInterceptor
} from '@angular/common/http';
import { Observable } from 'rxjs';
import { BackendService } from './backend.service'; // Asegúrate que esta ruta a tu servicio es correcta

@Injectable()
export class AuthInterceptor implements HttpInterceptor {

  // Inyectamos el BackendService para obtener el token
  constructor(private backendService: BackendService) {}

  intercept(request: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {
    const token = this.backendService.getToken();
    
    // Solo si tenemos un token, clonamos la solicitud y añadimos el encabezado.
    if (token) {
      // Clona la solicitud para añadir el encabezado de autorización
      const clonedRequest = request.clone({
        setHeaders: {
          Authorization: `Bearer ${token}` // Añade el token con el formato JWT estándar
        }
      });
      return next.handle(clonedRequest);
    }

    // Si no hay token, pasa la solicitud original sin modificar.
    return next.handle(request);
  }
}