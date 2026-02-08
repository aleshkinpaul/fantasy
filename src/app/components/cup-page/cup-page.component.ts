import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HeaderComponent } from '../header/header.component';

@Component({
  selector: 'app-cup-page',
  templateUrl: './cup-page.component.html',
  styleUrls: ['./cup-page.component.scss'],
  standalone: true,
  imports: [CommonModule, HeaderComponent]
})
export class CupPageComponent {

}
