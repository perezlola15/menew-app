import { Component, OnInit } from '@angular/core';
import { BackendService } from './services/backend.service';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  //styleUrls: ['./app.component.css']
})
export class AppComponent implements OnInit {

  constructor(private backend: BackendService) {}

  ngOnInit() {
    // Hacer login automáticamente al iniciar el componente
    this.backend.login('lola@menew.com', 'lola123').subscribe(res => {
      this.backend.setToken(res.token);
      console.log('Logged in user:', res.user);
    });
  }
}

