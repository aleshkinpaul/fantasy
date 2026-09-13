import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { MainPageComponent } from './components/main-page/main-page.component';
import { HomePageComponent } from './components/home-page/home-page.component';

const routes: Routes = [
  { path: '', component: HomePageComponent, pathMatch: 'full' },
  { path: 'tournaments', component: MainPageComponent, pathMatch: 'full' },
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
    path: 'world-cup/new', 
    loadComponent: () => import('./components/league-h2h-page/league-h2h-page.component').then(m => m.LeagueH2HPageComponent),
    pathMatch: 'full' 
  },
  { 
    path: 'spain-cup', 
    loadComponent: () => import('./components/cup-page/cup-page.component').then(m => m.CupPageComponent)
  },
  { 
    path: 'club-world-cup', 
    loadComponent: () => import('./components/cwc-page/cwc-page.component').then(m => m.CWCPageComponent)
  },
  {
    path: 'hall-of-fame',
    loadComponent: () => import('./components/hall-of-fame/hall-of-fame.component').then(m => m.HallOfFameComponent),
    pathMatch: 'full'
  },
  {
    path: 'rating',
    loadComponent: () => import('./components/rating-page/rating-page.component').then(m => m.RatingPageComponent),
    pathMatch: 'full'
  },
  {
    path: 'participants/:participantId',
    loadComponent: () => import('./components/participant-profile/participant-profile.component').then(m => m.ParticipantProfileComponent),
    pathMatch: 'full'
  },
  {
    path: 'draw',
    loadComponent: () => import('./components/draw-page/draw-page.component').then(m => m.DrawPageComponent),
    pathMatch: 'full'
  },
  {
    path: 'retro/:tournamentId',
    loadComponent: () => import('./components/retro-tournament-page/retro-tournament-page.component').then(m => m.RetroTournamentPageComponent),
    pathMatch: 'full'
  },
  { path: '**', redirectTo: '', pathMatch: 'full' },
];

@NgModule({
  imports: [RouterModule.forRoot(routes, { enableTracing: false, useHash: true })],
  exports: [RouterModule]
})
export class AppRoutingModule { }
