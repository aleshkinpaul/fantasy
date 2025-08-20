import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { MainPageComponent } from './components/main-page/main-page.component';
import { LeaguePageComponent } from './components/league-page/league-page.component';
import { CupPageComponent } from './components/cup-page/cup-page.component';
import { GraphQLModule } from './graphql.module';
import { HTTP_INTERCEPTORS, HttpClientModule } from '@angular/common/http';
import { HeaderComponent } from './components/header/header.component';
import { DefaultLoaderComponent } from './components/loader/default-loader.component';
import { LoaderInterceptor } from './interceptors/loader.interceptor';
import { LocationStrategy, PathLocationStrategy } from '@angular/common';
import { CWCPageComponent } from './components/cwc-page/cwc-page.component';
import { LeagueH2HPageComponent } from './components/league-h2h-page/league-h2h-page.component';

@NgModule({
  declarations: [
    AppComponent,
    HeaderComponent,
    MainPageComponent,
    CWCPageComponent,
    LeaguePageComponent,
    LeagueH2HPageComponent,
    CupPageComponent,
    DefaultLoaderComponent
  ],
  imports: [
    BrowserModule,
    AppRoutingModule,
    GraphQLModule,
    HttpClientModule
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
