import { Directive, DestroyRef, HostBinding, Input } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { ParticipantDirectoryEntry } from '../models/participant-directory';
import { PersonalizationService } from '../service/personalization.service';

export type PersonalizedParticipantReference =
  | string
  | number
  | null
  | undefined
  | readonly (string | number | null | undefined)[];

@Directive({
  selector: '[appPersonalized]',
  standalone: true,
})
export class PersonalizedParticipantDirective {
  @HostBinding('class.is-personalized-participant') isPersonalized = false;
  @HostBinding('attr.data-personalized-participant') personalizedAttribute: 'true' | null = null;

  private reference: PersonalizedParticipantReference;
  private selectedParticipant: ParticipantDirectoryEntry | null = null;

  @Input()
  set appPersonalized(reference: PersonalizedParticipantReference) {
    this.reference = reference;
    this.updateHostState();
  }

  constructor(
    personalization: PersonalizationService,
    destroyRef: DestroyRef,
  ) {
    personalization.state$
      .pipe(takeUntilDestroyed(destroyRef))
      .subscribe(state => {
        this.selectedParticipant = state.mode === 'participant'
          ? state.selectedParticipant
          : null;
        this.updateHostState();
      });
  }

  private updateHostState(): void {
    this.isPersonalized = matchesPersonalizedParticipant(
      this.selectedParticipant,
      this.reference,
    );
    this.personalizedAttribute = this.isPersonalized ? 'true' : null;
  }
}

export function matchesPersonalizedParticipant(
  participant: ParticipantDirectoryEntry | null | undefined,
  reference: PersonalizedParticipantReference,
): boolean {
  if (!participant) return false;

  const references = Array.isArray(reference) ? reference : [reference];
  const normalized = new Set(
    references
      .filter((value): value is string | number => value !== null && value !== undefined)
      .map(value => String(value).trim())
      .filter(Boolean),
  );
  if (!normalized.size) return false;

  return normalized.has(participant.participantId)
    || participant.profileIds.some(profileId => normalized.has(profileId));
}
