import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { LeaguePageComponent } from './components/league-page/league-page.component';
import { MainPageComponent } from './components/main-page/main-page.component';
import { CupPageComponent } from './components/cup-page/cup-page.component';
import { CWCPageComponent } from './components/cwc-page/cwc-page.component';
import { LeagueH2HPageComponent } from './components/league-h2h-page/league-h2h-page.component';

const routes: Routes = [
  { path: '', component: MainPageComponent, pathMatch: 'full' },
  { path: 'spain/new', component: LeagueH2HPageComponent, pathMatch: 'full' },
  { path: 'spain', component: LeaguePageComponent },
  { path: 'champions-league/new', component: LeagueH2HPageComponent, pathMatch: 'full' },
  { path: 'champions-league', component: LeaguePageComponent },
  { path: 'spain-cup', component: CupPageComponent },
  { path: 'club-world-cup', component: CWCPageComponent },
  { path: '**', redirectTo: '', pathMatch: 'full' },
];

@NgModule({
  imports: [RouterModule.forRoot(routes, { enableTracing: false, useHash: false })],
  exports: [RouterModule]
})
export class AppRoutingModule { }
