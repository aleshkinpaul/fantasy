import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { Observable, catchError, forkJoin, map, of, shareReplay, switchMap } from 'rxjs';

import { CompetitionFacade, CompetitionViewModel } from '../../competition/data/competition.facade';
import { CompetitionType } from '../../competition/models/competition.models';
import { IPrizeNominee, IProfileDetails, IRuntimePrize } from '../../models/domain';
import { selectHomeStandings } from '../../home/home-standings';
import { TournamentKind, TournamentTimelineItem } from '../../models/tournament-catalog';
import { DataService } from '../../service/data.service';
import { TournamentCatalogService } from '../../service/tournament-catalog.service';
import { PersonalizedParticipantDirective } from '../../directives/personalized-participant.directive';

interface HomeTournamentSummary {
  tournament: TournamentTimelineItem;
  lastTour: number;
  stageName: string;
  standingsGroups: HomeStandingGroup[];
  prizes: IRuntimePrize[];
}

interface HomeStandingGroup {
  name: string;
  topFive: IProfileDetails[];
}

interface TournamentLoadResult {
  tournament: TournamentTimelineItem;
  summary?: HomeTournamentSummary;
  failed: boolean;
}

interface HomeDashboardState {
  summaries: HomeTournamentSummary[];
  failed: TournamentTimelineItem[];
}

@Component({
  selector: 'app-home-page',
  standalone: true,
  imports: [CommonModule, RouterModule, PersonalizedParticipantDirective],
  templateUrl: './home-page.component.html',
  styleUrls: ['./home-page.component.scss'],
})
export class HomePageComponent {
  readonly dashboard$: Observable<HomeDashboardState>;

  constructor(
    private readonly router: Router,
    catalogService: TournamentCatalogService,
    competitionFacade: CompetitionFacade,
    dataService: DataService,
  ) {
    dataService.setUrlName('');

    this.dashboard$ = catalogService.loadTimeline().pipe(
      map(seasons => seasons
        .flatMap(season => season.tournaments)
        .filter(tournament => tournament.status === 'active')
        .map(tournament => ({ tournament, type: competitionTypeFor(tournament.kind) }))
        .filter((item): item is { tournament: TournamentTimelineItem; type: CompetitionType } => item.type !== null)),
      switchMap(items => {
        if (!items.length) return of({ summaries: [], failed: [] });

        return forkJoin(items.map(({ tournament, type }) =>
          competitionFacade.load(type, tournament.yearStart).pipe(
            map(viewModel => ({
              tournament,
              summary: buildTournamentSummary(tournament, viewModel),
              failed: false,
            } as TournamentLoadResult)),
            catchError(error => {
              console.error(`Failed to load home summary for ${tournament.id}`, error);
              return of({ tournament, failed: true } as TournamentLoadResult);
            }),
          )
        )).pipe(map(results => ({
          summaries: results.flatMap(result => result.summary ? [result.summary] : []),
          failed: results.filter(result => result.failed).map(result => result.tournament),
        })));
      }),
      catchError(error => {
        console.error('Failed to load home dashboard', error);
        return of({ summaries: [], failed: [] });
      }),
      shareReplay({ bufferSize: 1, refCount: true }),
    );
  }

  openTournament(event: MouseEvent, route: string): void {
    if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;

    event.preventDefault();
    void this.router.navigateByUrl(route);
  }

  points(profile: IProfileDetails): number {
    return profile.results.points['common'] ?? 0;
  }

  fantasyPoints(profile: IProfileDetails): number {
    return profile.results.fo['common'] ?? profile.score ?? 0;
  }

  prizeLeaders(prize: IRuntimePrize): IPrizeNominee[] {
    return prize.activeLeaders.slice(0, 3);
  }

  hiddenLeadersCount(prize: IRuntimePrize): number {
    return Math.max(0, prize.activeLeaders.length - 3);
  }

  prizeValue(prize: IRuntimePrize, leader: IPrizeNominee): string | number | null {
    return prize.isSecret ? null : leader.prizes[prize.id]?.value ?? null;
  }

  prizeStateText(prize: IRuntimePrize): string {
    if (prize.state === 2) return 'Данные появятся позднее';
    if (prize.state === 3) return 'Нет подходящих команд';
    return 'Лидеры определятся позднее';
  }

  prizesRoute(route: string): string {
    return `${route}${route.includes('?') ? '&' : '?'}tabId=3`;
  }

  trackTournament(_index: number, summary: HomeTournamentSummary): string {
    return summary.tournament.id;
  }

  trackProfile(_index: number, profile: IProfileDetails): string {
    return profile.id;
  }

  trackStandingGroup(_index: number, group: HomeStandingGroup): string {
    return group.name;
  }

  trackPrize(_index: number, prize: IRuntimePrize): number {
    return prize.id;
  }

  trackLeader(_index: number, leader: IPrizeNominee): string {
    return leader.id;
  }
}

function buildTournamentSummary(
  tournament: TournamentTimelineItem,
  viewModel: CompetitionViewModel,
): HomeTournamentSummary {
  const selection = selectHomeStandings(
    viewModel.config.stages,
    viewModel.leaguesRatings,
    viewModel.leaguesRatings['Common'] ?? viewModel.profilesDetails,
    viewModel.lastTour,
  );

  return {
    tournament,
    lastTour: viewModel.lastTour,
    stageName: selection.stageName,
    standingsGroups: selection.groups.map(group => ({
      name: group.name,
      topFive: group.entries,
    })),
    prizes: viewModel.prizes,
  };
}

function competitionTypeFor(kind: TournamentKind): CompetitionType | null {
  if (kind === 'la-liga') return 'spain';
  if (kind === 'champions-league') return 'champions-league';
  if (kind === 'summer') return 'world-cup';
  return null;
}
