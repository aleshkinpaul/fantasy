import { HTTP_INTERCEPTORS, HttpClientModule } from '@angular/common/http';
import { importProvidersFrom } from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';

import { AppComponent } from './app/app.component';
import { AppRoutingModule } from './app/app-routing.module';
import { LoaderInterceptor } from './app/interceptors/loader.interceptor';

bootstrapApplication(AppComponent, {
  providers: [
    importProvidersFrom(AppRoutingModule, HttpClientModule),
    { provide: HTTP_INTERCEPTORS, useClass: LoaderInterceptor, multi: true },
  ],
})
  .catch(err => console.error(err));
