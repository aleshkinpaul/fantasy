import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { Observable, catchError, combineLatest, forkJoin, map, of, shareReplay, switchMap } from 'rxjs';

import { CompetitionFacade, CompetitionViewModel } from '../../competition/data/competition.facade';
import { CompetitionType } from '../../competition/models/competition.models';
import { IPrizeNominee, IProfileDetails, IRuntimePrize } from '../../models/domain';
import { selectHomeStandings } from '../../home/home-standings';
import { TournamentKind, TournamentTimelineItem } from '../../models/tournament-catalog';
import { DataService } from '../../service/data.service';
import { TournamentCatalogService } from '../../service/tournament-catalog.service';
import { PersonalizedParticipantDirective } from '../../directives/personalized-participant.directive';
import {
  PersonalizedHomeMatch,
  PersonalizedHomeTournament,
  PersonalizedStandingRow,
  buildPersonalizedHomeTournament,
} from '../../home/personalized-home';
import { ParticipantDirectoryEntry } from '../../models/participant-directory';
import { PersonalizationService } from '../../service/personalization.service';

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
  viewModel?: CompetitionViewModel;
  failed: boolean;
}

interface HomeDashboardState {
  summaries: HomeTournamentSummary[];
  failed: TournamentTimelineItem[];
  personalizedParticipant: ParticipantDirectoryEntry | null;
  personalized: PersonalizedHomeTournament[];
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
    personalization: PersonalizationService,
  ) {
    dataService.setUrlName('');

    const tournamentData$ = catalogService.loadTimeline().pipe(
      map(seasons => seasons
        .flatMap(season => season.tournaments)
        .filter(tournament => tournament.status === 'active')
        .map(tournament => ({ tournament, type: competitionTypeFor(tournament.kind) }))
        .filter((item): item is { tournament: TournamentTimelineItem; type: CompetitionType } => item.type !== null)),
      switchMap(items => {
        if (!items.length) return of([] as TournamentLoadResult[]);

        return forkJoin(items.map(({ tournament, type }) =>
          competitionFacade.load(type, tournament.yearStart).pipe(
            map(viewModel => ({
              tournament,
              summary: buildTournamentSummary(tournament, viewModel),
              viewModel,
              failed: false,
            } as TournamentLoadResult)),
            catchError(error => {
              console.error(`Failed to load home summary for ${tournament.id}`, error);
              return of({ tournament, failed: true } as TournamentLoadResult);
            }),
          )
        ));
      }),
      catchError(error => {
        console.error('Failed to load home dashboard', error);
        return of([] as TournamentLoadResult[]);
      }),
      shareReplay({ bufferSize: 1, refCount: true }),
    );

    this.dashboard$ = combineLatest([tournamentData$, personalization.state$]).pipe(
      map(([results, personalizationState]) => {
        const selectedParticipant = personalizationState.mode === 'participant'
          ? personalizationState.selectedParticipant
          : null;
        return {
          summaries: results.flatMap(result => result.summary ? [result.summary] : []),
          failed: results.filter(result => result.failed).map(result => result.tournament),
          personalizedParticipant: selectedParticipant,
          personalized: selectedParticipant
            ? results.flatMap(result => result.viewModel
              ? optionalItem(buildPersonalizedHomeTournament(
                result.tournament,
                result.viewModel,
                selectedParticipant,
              ))
              : [])
            : [],
        };
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

  personalPoints(row: PersonalizedStandingRow, summary: PersonalizedHomeTournament): number {
    return row.profile.results.points[summary.standingKey] ?? 0;
  }

  personalFantasyPoints(row: PersonalizedStandingRow, summary: PersonalizedHomeTournament): number {
    return row.profile.results.fo[summary.standingKey] ?? row.profile.score ?? 0;
  }

  hasScore(match: PersonalizedHomeMatch): boolean {
    return match.homeScore !== undefined && match.awayScore !== undefined;
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

  trackPersonalTournament(_index: number, summary: PersonalizedHomeTournament): string {
    return summary.tournament.id;
  }

  trackPersonalStanding(_index: number, row: PersonalizedStandingRow): string {
    return row.profile.id;
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

function optionalItem<T>(item: T | null): T[] {
  return item ? [item] : [];
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
