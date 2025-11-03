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

  onSubmit() {
    if (this.loginForm.invalid) return;

    this.loading = true;
    const { email, password } = this.loginForm.value;

    this.backend.login(email, password).subscribe({
      next: (res) => {
        //this.backend.setToken(res.token);
        this.loading = false;
        // Redirige según rol
        if (res.user.role === 'client') {
          this.router.navigate(['/calendar']);
        } else {
          this.router.navigate(['/admin']);
        }
      },
      error: (err) => {
        console.error(err);
        this.loading = false;
        alert('Login failed. Check credentials.');
      },
    });
  }
}
