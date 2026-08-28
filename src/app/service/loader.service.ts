import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class LoaderService {
  private isLoading = new BehaviorSubject<boolean>(false);
  private activeRequests = 0;
  public isLoading$ = this.isLoading.asObservable();

  showLoader(): void {
    this.activeRequests += 1;
    if (this.activeRequests === 1) this.isLoading.next(true);
  }

  hideLoader(): void {
    this.activeRequests = Math.max(0, this.activeRequests - 1);
    if (this.activeRequests === 0 && this.isLoading.value) {
      this.isLoading.next(false);
    }
  }
}
