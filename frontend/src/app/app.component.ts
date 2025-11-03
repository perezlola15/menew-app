import { Component, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { BackendService } from './services/backend.service';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  standalone: true,       
  imports: [RouterOutlet] 
})
export class AppComponent implements OnInit {

  constructor(private backend: BackendService) {}

  ngOnInit() {
    this.backend.login('lola@menew.com', 'lola123').subscribe(res => {
      console.log('Logged in user:', res.user);
    });
  }
}
