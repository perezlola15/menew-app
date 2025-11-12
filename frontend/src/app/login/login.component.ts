import { Component } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { BackendService } from '../services/backend.service';
import { CommonModule } from '@angular/common';
import { AuthService } from '../auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [ReactiveFormsModule, CommonModule],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss'],
})
export class LoginComponent {
  loginForm: FormGroup;
  loading = false;
  error: string | null = null;
  logo = 'assets/dist/img/logo-trans.png';

  constructor(
    private fb: FormBuilder,
    private backend: BackendService,
    private router: Router,
    private authService: AuthService
  ) {
    this.loginForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', Validators.required],
    });
  }

  handleDismiss() {
    this.error = null;
  }

  onSubmit() {
    if (this.loginForm.invalid) return;

    this.loading = true;
    this.error = null;
    const { email, password } = this.loginForm.value;

    this.backend.login(email, password).subscribe({
      next: (res: any) => {
        this.loading = false;
        if (res.token) {
          localStorage.setItem('token', res.token);
        }

        if (res.user?.role) {
          this.authService.login(res.user.role); // Guarda el rol en localStorage
        }
        // Redirige según rol
        if (res.user?.role === 'client') {
          this.router.navigate(['/calendar']);
        } else if (res.user?.role === 'admin') {
          this.router.navigate(['/admin']);
        } else {
          this.router.navigate(['/login']);
        }
      },
      error: (err) => {
        console.error(err);
        this.loading = false;
        // Muestra mensaje de error si las credenciales son incorrectas
        if (err?.status === 401) {
          this.error = err.error?.error || 'Invalid credentials';
        } else {
          this.error = err?.error?.message || 'Server error';
        }
      },
    });
  }
}
