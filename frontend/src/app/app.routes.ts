import { Routes } from '@angular/router';
import { LoginComponent } from './login/login.component';
import { AdminComponent } from './admin/admin.component';
import { CalendarComponent } from './calendar/calendar.component';
import { RoleGuard } from './auth/role.guard';
import { PageNotFoundComponent } from './page-not-found/page-not-found.component';

export const routes: Routes = [
  { path: '', redirectTo: 'login', pathMatch: 'full' },

  // Ruta de Login: Sin protección, ya que todos pueden acceder
  { path: 'login', component: LoginComponent },

  // Ruta de Admin: Solo puede acceder el rol 'admin'
  {
    path: 'admin',
    component: AdminComponent,
    canActivate: [RoleGuard],        
    data: { roles: ['admin'] } 
  },

  // Ruta de Calendar: Solo puede acceder el rol 'client'
  {
    path: 'calendar',
    component: CalendarComponent,
    canActivate: [RoleGuard],
    data: { roles: ['client'] }
  },

  // Si se establece cualquier otra ruta, se redirigirá a la página de error 404 not found
  { path: '404', component: PageNotFoundComponent },
  { path: '**', redirectTo: '/404' }
];

