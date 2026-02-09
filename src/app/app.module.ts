import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { RouterModule } from '@angular/router';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { MainPageComponent } from './components/main-page/main-page.component';
import { GraphQLModule } from './graphql.module';
import { HTTP_INTERCEPTORS, HttpClientModule } from '@angular/common/http';
import { LoaderInterceptor } from './interceptors/loader.interceptor';
import { LocationStrategy, PathLocationStrategy } from '@angular/common';

@NgModule({
  declarations: [],
  imports: [
    BrowserModule,
    RouterModule,
    AppRoutingModule,
    GraphQLModule,
    HttpClientModule,
    MainPageComponent,
    AppComponent
  ],
  providers: [
    {provide: LocationStrategy, useClass: PathLocationStrategy},
    {
      provide: HTTP_INTERCEPTORS,
      useClass: LoaderInterceptor,
      multi: true
    }
  ],
  bootstrap: [AppComponent]
})
export class AppModule { }
