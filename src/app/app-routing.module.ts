import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { LeaguePageComponent } from './components/league-page/league-page.component';
import { MainPageComponent } from './components/main-page/main-page.component';
import { CupPageComponent } from './components/cup-page/cup-page.component';

const routes: Routes = [
  { path: '', component: MainPageComponent, pathMatch: 'full' },
  { path: 'spain', component: LeaguePageComponent },
  { path: 'champions-league', component: LeaguePageComponent },
  { path: 'spain-cup', component: CupPageComponent },
  { path: '**', redirectTo: '', pathMatch: 'full' },
];

@NgModule({
  imports: [RouterModule.forRoot(routes, { enableTracing: false, useHash: false })],
  exports: [RouterModule]
})
export class AppRoutingModule { }
