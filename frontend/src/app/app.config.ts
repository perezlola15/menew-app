// src/app/app.config.ts
import { ApplicationConfig, importProvidersFrom, provideZoneChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';

import { routes } from './app.routes';

import { 
  provideHttpClient, 
  withInterceptorsFromDi, 
  HTTP_INTERCEPTORS // <-- Asegúrate de que esta importación esté
} from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { provideClientHydration, withEventReplay } from '@angular/platform-browser';

// 🚨 Ahora este archivo existe y se puede importar
import { AuthInterceptor } from './services/auth.interceptor'; 

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    provideClientHydration(withEventReplay()),
    
    // Habilitar la inyección de interceptores
    provideHttpClient(
        withInterceptorsFromDi() 
    ), 
    
    // Registrar la clase AuthInterceptor
    {
      provide: HTTP_INTERCEPTORS,
      useClass: AuthInterceptor,
      multi: true
    },
    
    importProvidersFrom(FormsModule),
  ]
};