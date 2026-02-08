import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { MainPageComponent } from './components/main-page/main-page.component';

const routes: Routes = [
  { path: '', component: MainPageComponent, pathMatch: 'full' },
  { 
    path: 'spain/new', 
    loadComponent: () => import('./components/league-h2h-page/league-h2h-page.component').then(m => m.LeagueH2HPageComponent),
    pathMatch: 'full' 
  },
  { 
    path: 'spain', 
    loadComponent: () => import('./components/league-page/league-page.component').then(m => m.LeaguePageComponent)
  },
  { 
    path: 'champions-league/new', 
    loadComponent: () => import('./components/league-h2h-page/league-h2h-page.component').then(m => m.LeagueH2HPageComponent),
    pathMatch: 'full' 
  },
  { 
    path: 'champions-league', 
    loadComponent: () => import('./components/league-page/league-page.component').then(m => m.LeaguePageComponent)
  },
  { 
    path: 'spain-cup', 
    loadComponent: () => import('./components/cup-page/cup-page.component').then(m => m.CupPageComponent)
  },
  { 
    path: 'club-world-cup', 
    loadComponent: () => import('./components/cwc-page/cwc-page.component').then(m => m.CWCPageComponent)
  },
  { path: '**', redirectTo: '', pathMatch: 'full' },
];

@NgModule({
  imports: [RouterModule.forRoot(routes, { enableTracing: false, useHash: false })],
  exports: [RouterModule]
})
export class AppRoutingModule { }
