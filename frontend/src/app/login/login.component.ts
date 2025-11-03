import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { BackendService } from '../services/backend.service';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div style="max-width:400px; margin:auto; padding:1rem;">
      <h2>Login</h2>
      <form (ngSubmit)="onSubmit()">
        <label>Email:</label>
        <input type="email" [(ngModel)]="email" name="email" required class="form-control" />
        <label>Password:</label>
        <input type="password" [(ngModel)]="password" name="password" required class="form-control" />
        <button type="submit" class="btn btn-primary" style="margin-top:1rem;">Login</button>
      </form>
      <p *ngIf="error" style="color:red;">{{ error }}</p>
    </div>
  `
})
export class LoginComponent {
  email = '';
  password = '';
  error: string | null = null;

  constructor(private backend: BackendService, private router: Router) {}

  onSubmit() {
    this.error = null;
    this.backend.login(this.email, this.password).subscribe({
      next: res => {
        if (res.user.role === 'admin') {
          this.router.navigate(['/admin']);
        } else {
          this.router.navigate(['/calendar']);
        }
      },
      error: err => {
        this.error = err.error?.message || 'Error al hacer login';
      }
    });
  }
}
