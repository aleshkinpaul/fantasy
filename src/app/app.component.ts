import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { DataService } from './service/data.service';
import { HeaderComponent } from './components/header/header.component';
import { DefaultLoaderComponent } from './components/loader/default-loader.component';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
  standalone: true,
  imports: [CommonModule, RouterModule, HeaderComponent, DefaultLoaderComponent]
})
export class AppComponent implements OnInit {
  title = 'fr-fantasy';
  name: string = '';

  constructor(
    public service: DataService, 
  ) {}

  ngOnInit(): void {
    this.service.urlName$.subscribe(name => this.name = name);
  }
}
