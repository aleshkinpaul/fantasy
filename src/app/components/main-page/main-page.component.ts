import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { HeaderComponent } from '../header/header.component';

@Component({
  selector: 'app-main-page',
  templateUrl: './main-page.component.html',
  styleUrls: ['./main-page.component.scss'],
  standalone: true,
  imports: [CommonModule, RouterModule, HeaderComponent]
})
export class MainPageComponent {
  constructor(private router: Router) {}

  goToUrl(url) {
    this.router.navigateByUrl(url);
  }
}
