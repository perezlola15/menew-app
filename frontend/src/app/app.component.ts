import { Component, OnInit } from '@angular/core';
import { Router, RouterOutlet, NavigationEnd } from '@angular/router';
import { BackendService } from './services/backend.service';
import { CommonModule } from '@angular/common';
import { NavbarComponent } from './navbar/navbar.component';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  standalone: true,
  imports: [
    CommonModule,
    RouterOutlet,
    NavbarComponent
  ]
})
export class AppComponent implements OnInit {

  currentUrl: string = '';

  constructor(
    private backend: BackendService,
    private router: Router
  ) {
    // Escuchar los cambios de ruta
    this.router.events.subscribe(event => {
      if (event instanceof NavigationEnd) {
        this.currentUrl = event.urlAfterRedirects;
      }
    });
  }

  ngOnInit() {
    // Inicializa la URL actual
    this.currentUrl = this.router.url;
  }

  // Devuelve true si la ruta empieza por /login o /404
  isLoginOr404Route(): boolean {
    return (
      this.currentUrl.startsWith('/login') ||
      this.currentUrl.startsWith('/404')
    );
  }
}