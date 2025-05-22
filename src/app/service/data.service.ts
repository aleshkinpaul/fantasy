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
}
