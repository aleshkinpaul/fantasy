import { Injectable } from '@angular/core';
import { Observable, combineLatest, map } from 'rxjs';

import { ParticipantProfileService } from '../service/participant-profile.service';
import { TournamentCatalogService } from '../service/tournament-catalog.service';
import { calculatePowerRating } from './rating.calculator';
import { PowerRating } from './rating.models';

@Injectable({ providedIn: 'root' })
export class RatingService {
  constructor(
    private readonly participantService: ParticipantProfileService,
    private readonly catalogService: TournamentCatalogService,
  ) {}

  loadRating(includeLive: boolean): Observable<PowerRating> {
    return combineLatest([
      this.participantService.loadProfiles(),
      this.catalogService.loadTimeline(),
    ]).pipe(map(([profiles, timeline]) => calculatePowerRating(profiles, timeline, includeLive)));
  }
}
