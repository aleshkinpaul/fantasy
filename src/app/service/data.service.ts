import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { print } from 'graphql/language/printer';
import { BehaviorSubject } from 'rxjs';
import { IProfile } from '../models/model';

@Injectable({
  providedIn: 'root'
})
export class DataService {

  constructor(private http: HttpClient) {}

	public urlName = new BehaviorSubject<string>('')
  public urlName$ = this.urlName.asObservable();
  
  setUrlName(url: string): void {
    this.urlName.next(url);
  }
  
  getUrlName(): string {
    return this.urlName.value;
  }

  getImage(url: string) {
    return this.http.get(url);
  }

  getData(url: string) {
    return this.http.get(url);
  }

  comparePlaces(a, b) {
    if (a.place < b.place) {
      return -1;
    } else if (a.place > b.place) {
      return 1;
    }
    return 0;
  }
  
  getRgbForTour(score, max, min) {
    const value = (score - min)/(max - min);

    const colors = [
      { r: 183, g: 51, b: 42 }, // 0
      { r: 243, g: 169, b: 109 }, // 0.25
      { r: 255, g: 214, b: 102 }, // 0.5
      { r: 171, g: 201, b: 120 }, // 0.75
      { r: 55, g: 112, b: 82 }   // 1
    ];
    
    const lowerIndex = Math.floor(value * (colors.length - 1));
    const upperIndex = Math.min(lowerIndex + 1, colors.length - 1);
    const lowerColor = colors[lowerIndex];
    const upperColor = colors[upperIndex];
  
    const ratio = (value * (colors.length - 1)) - lowerIndex;
    const r = Math.round(lowerColor.r + (upperColor.r - lowerColor.r) * ratio);
    const g = Math.round(lowerColor.g + (upperColor.g - lowerColor.g) * ratio);
    const b = Math.round(lowerColor.b + (upperColor.b - lowerColor.b) * ratio);
  
    return `rgb(${r}, ${g}, ${b})`;
  }

  sortByScore(a,b) {
    return b.score - a.score;
  }
}
