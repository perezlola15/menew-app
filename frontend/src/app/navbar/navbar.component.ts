import { Component, OnInit } from '@angular/core';
import { BackendService } from '../services/backend.service';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [CommonModule, RouterModule], 
  templateUrl: './navbar.component.html',
  styleUrls: ['./navbar.component.scss']
})
export class NavbarComponent implements OnInit {
  menuAbierto = false;
  userEmail: string | null = null;
  isAdmin: boolean = false;

  constructor(private backend: BackendService, private router: Router) { }

  ngOnInit() {
    // Cada vez que el usuario cambia, actualizamos userEmail y el estado de administración
    this.backend.user$.subscribe(user => {
      this.userEmail = user?.email || null;
      // Comprobar si el usuario existe y su rol es 'admin'
      this.isAdmin = user?.role === 'admin';
    });
  }

  toggleMenu() {
    this.menuAbierto = !this.menuAbierto;
  }

  logout() {
    this.backend.logout();
    // Redirigir al login cuando cierra sesión el usuario
    this.router.navigate(['/login']);
  }
}