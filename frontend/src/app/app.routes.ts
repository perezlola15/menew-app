import { Routes } from '@angular/router';
import { LoginComponent } from './login/login.component';
import { AdminComponent } from './admin/admin.component';
import { CalendarComponent } from './calendar/calendar.component';
import { AdminDishesComponent } from './admin-dishes/admin-dishes.component';
import { AdminUsersComponent } from './admin-users/admin-users.component';


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

  // Ruta de Crud de los platos: Solo puede acceder el rol 'admin'
  {
    path: 'dishes',
    component: AdminDishesComponent,
    canActivate: [RoleGuard],
    data: { roles: ['admin'] }
  },

  // Ruta de Crud de los platos: Solo puede acceder el rol 'admin'
  {
    path: 'users',
    component: AdminUsersComponent,
    canActivate: [RoleGuard],
    data: { roles: ['admin'] }
  },

  // Si se establece cualquier otra ruta, se redirigirá a la página de error 404 not found
  { path: '404', component: PageNotFoundComponent },

  // Wildcard para cualquier otra ruta → mostrar directamente 404
  { path: '**', component: PageNotFoundComponent }
];

