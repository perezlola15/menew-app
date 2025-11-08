import { Component } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { BackendService } from '../services/backend.service';
import { CommonModule } from '@angular/common';

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
  // Ajusta la ruta según dónde coloques la imagen en assets
  logo = 'assets/dist/img/logo-trans.png';

  constructor(
    private fb: FormBuilder,
    private backend: BackendService,
    private router: Router
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
        // ejemplo: si devuelves token, aquí lo guardas (cookie/localStorage)
        // localStorage.setItem('token', res.token);

        // redirige según rol
        if (res.user?.role === 'client') {
          this.router.navigate(['/calendar']);
        } else {
          this.router.navigate(['/admin']);
        }
      },
      error: (err) => {
        console.error(err);
        this.loading = false;
        // muestra mensaje de error (ajusta según formato de tu API)
        if (err?.status === 401) {
          this.error = err.error?.error || 'Credenciales incorrectas';
        } else {
          this.error = err?.error?.message || 'Error de servidor';
        }
      },
    });
  }
}
