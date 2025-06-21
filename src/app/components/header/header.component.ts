import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { DataService } from 'src/app/service/data.service';

@Component({
  selector: 'app-header',
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.scss']
})
export class HeaderComponent implements OnInit {
  public isMain: boolean = true;
  public subTitle: string = '';
  public name: string = '';

  constructor(private service: DataService, private router: Router) {}

  ngOnInit(): void {
    this.service.urlName$.subscribe(name => {
      this.isMain = !name;
      this.name = name;
      this.subTitle = '';
      if (!this.isMain) {
        this.subTitle =
          name === 'spain'            ? 'Ла Лига'         :
          name === 'champions-league' ? 'Лига Чемпионов'  :
          name === 'spain-cup'        ? 'Кубок Испании'   : 
          name === 'club-world-cup'   ? 'Клубный ЧМ'      : ''
      }
    });
  }
  
  goHome () {
    this.router.navigateByUrl('/');
    this.service.setUrlName('');
  };
}
