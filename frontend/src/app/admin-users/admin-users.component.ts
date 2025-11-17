import { Component, OnInit, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { BackendService, User, UserForm } from '../services/backend.service'; // Asegúrate de la ruta

@Component({
  selector: 'app-admin-users',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-users.component.html',
  styleUrl: './admin-users.component.scss'
})
export class AdminUsersComponent implements OnInit {
  // Inyección de dependencias
  private backendService = inject(BackendService);

  // --- State Signals ---
  users = signal<User[]>([]);

  // Forma para crear/editar usuarios
  userForm: UserForm = {
    email: '',
    password: '',
    role: 'client'
  };

  editingUserId = signal<number | null>(null);

  // General Message
  message = signal<{ text: string, type: 'success' | 'error' } | null>(null);

  // --- Computed Properties ---
  isEditingUser = computed(() => this.editingUserId() !== null);

  sortedUsers = computed(() => {
    // Ordenar por rol (admin primero) y luego por email
    return [...this.users()].sort((a, b) => {
      if (a.role === 'admin' && b.role === 'client') return -1;
      if (a.role === 'client' && b.role === 'admin') return 1;
      return a.email.localeCompare(b.email);
    });
  });

  ngOnInit(): void {
    this.loadUsers();
  }

  // --- Helper ---

  showMessage(text: string, type: 'success' | 'error'): void {
    this.message.set({ text, type });
    setTimeout(() => this.message.set(null), 5000);
  }

  // --- Usuarios CRUD ---

  loadUsers(): void {
    this.backendService.getUsers().subscribe({
      next: (users) => this.users.set(users),
      error: (err) => {
        this.showMessage('Error cargando usuarios.', 'error');
        console.error('Error cargando usuarios:', err);
      }
    });
  }

  resetForm(): void {
    this.userForm = {
      email: '',
      password: '',
      role: 'client'
    };
    this.editingUserId.set(null);
  }

  editUser(user: User): void {
    this.userForm = {
      email: user.email,
      // La contraseña no se carga para edición
      password: '',
      role: user.role
    };
    this.editingUserId.set(user.id);
  }

  saveUser(): void {
    if (this.isEditingUser()) {
      // Edición
      const updatePayload = {
        email: this.userForm.email,
        role: this.userForm.role
      };

      this.backendService.updateUser(this.editingUserId()!, updatePayload).subscribe({
        next: (updatedUser) => {
          this.users.update(u => u.map(user => user.id === updatedUser.id ? updatedUser : user));
          this.showMessage(`Usuario "${updatedUser.email}" actualizado con éxito.`, 'success');
          this.resetForm();
        },
        error: (err) => {
          this.showMessage('Error al editar el usuario.', 'error');
          console.error(err);
        }
      });
    } else {
      // Creación
      if (!this.userForm.password) {
        this.showMessage('La contraseña es requerida para nuevos usuarios.', 'error');
        return;
      }

      this.backendService.addUser(this.userForm).subscribe({
        next: (newUser) => {
          this.users.update(u => [...u, newUser]);
          this.showMessage(`Usuario "${newUser.email}" añadido con éxito.`, 'success');
          this.resetForm();
        },
        error: (err) => {
          this.showMessage('Error al añadir el usuario. El email podría estar duplicado.', 'error');
          console.error(err);
        }
      });
    }
  }

  deleteUser(id: number): void {
    // IMPORTANTE: Cambiar 'confirm' por un modal de confirmación en producción
    if (!confirm('¿Estás seguro de que quieres eliminar este usuario?')) return;

    this.backendService.deleteUser(id).subscribe({
      next: () => {
        this.users.update(u => u.filter(user => user.id !== id));
        this.showMessage('Usuario eliminado con éxito.', 'success');
      },
      error: (err) => {
        this.showMessage('Error al eliminar el usuario. Podría tener menús asignados.', 'error');
        console.error(err);
      }
    });
  }
  getUserInitial(email: string): string {
    return email.charAt(0).toUpperCase();
  }
}