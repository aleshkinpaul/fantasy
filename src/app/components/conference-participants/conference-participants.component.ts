import { CommonModule } from '@angular/common';
import { Component, Input, OnChanges } from '@angular/core';

import { IProfileDetails } from '../../models/domain';
import { ParticipantCardComponent } from '../participant-card/participant-card.component';

export interface ConferenceParticipantEntry {
  profileId: string;
  profile?: IProfileDetails;
}

@Component({
  selector: 'app-conference-participants',
  standalone: true,
  imports: [CommonModule, ParticipantCardComponent],
  templateUrl: './conference-participants.component.html',
  styleUrls: ['./conference-participants.component.scss']
})
export class ConferenceParticipantsComponent implements OnChanges {
  @Input() profileIds: string[] = [];
  @Input() profiles: IProfileDetails[] = [];
  @Input() competitionType = 'spain';

  participants: ConferenceParticipantEntry[] = [];

  ngOnChanges(): void {
    this.participants = buildConferenceParticipants(this.profileIds, this.profiles);
  }

  trackParticipant(_index: number, participant: ConferenceParticipantEntry): string {
    return participant.profileId;
  }
}

export function buildConferenceParticipants(
  profileIds: string[],
  profiles: IProfileDetails[],
): ConferenceParticipantEntry[] {
  const profilesById = new Map(profiles.map(profile => [profile.id, profile]));
  return profileIds.map(profileId => ({
    profileId,
    profile: profilesById.get(profileId)
  }));
}
