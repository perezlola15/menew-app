import { Component, OnInit } from '@angular/core';
import { BackendService } from '../services/backend.service';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './navbar.component.html',
  styleUrls: ['./navbar.component.scss']
})
export class NavbarComponent implements OnInit {
  menuAbierto = false;
  userEmail: string | null = null;

  constructor(private backend: BackendService, private router: Router) {}

  ngOnInit() {
    // Cada vez que el usuario cambia, actualizamos userEmail
    this.backend.user$.subscribe(user => {
      this.userEmail = user?.email || null;
    });
  }

  toggleMenu() {
    this.menuAbierto = !this.menuAbierto;
  }

  logout() {
    this.backend.logout();
    // opcional: redirigir al login si quieres
    this.router.navigate(['/login']);
  }
}
