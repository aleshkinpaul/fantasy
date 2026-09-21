import {
  Component,
  DestroyRef,
  ElementRef,
  HostListener,
  Inject,
  OnDestroy,
  OnInit,
} from '@angular/core';
import { CommonModule, DOCUMENT } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { ParticipantDirectoryEntry } from '../../models/participant-directory';
import { PersonalizationState } from '../../models/personalization';
import { formatParticipantNameSurnameFirst } from '../../service/participant-directory.service';
import { PersonalizationService } from '../../service/personalization.service';

const GUEST_CHOICE = 'guest';

@Component({
  selector: 'app-participant-picker',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './participant-picker.component.html',
  styleUrls: ['./participant-picker.component.scss'],
})
export class ParticipantPickerComponent implements OnInit, OnDestroy {
  readonly state$ = this.personalization.state$;
  search = '';
  selectedChoice = '';
  filteredParticipants: ParticipantDirectoryEntry[] = [];

  private wasOpen = false;

  constructor(
    readonly personalization: PersonalizationService,
    private readonly elementRef: ElementRef<HTMLElement>,
    private readonly destroyRef: DestroyRef,
    @Inject(DOCUMENT) private readonly document: Document,
  ) {}

  ngOnInit(): void {
    this.state$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(state => {
      this.filteredParticipants = this.filterParticipants(state.participants, this.search);

      if (state.pickerOpen && !this.wasOpen) {
        this.search = '';
        this.filteredParticipants = state.participants;
        this.selectedChoice = state.mode === 'participant'
          ? state.selectedParticipant?.participantId ?? ''
          : state.mode === 'guest' ? GUEST_CHOICE : '';
        this.document.body.classList.add('participant-picker-open');
        setTimeout(() => this.focusFirstControl());
      } else if (!state.pickerOpen && this.wasOpen) {
        this.document.body.classList.remove('participant-picker-open');
      }

      this.wasOpen = state.pickerOpen;
    });
  }

  ngOnDestroy(): void {
    this.document.body.classList.remove('participant-picker-open');
  }

  onSearch(event: Event, participants: ParticipantDirectoryEntry[]): void {
    this.search = (event.target as HTMLInputElement).value;
    this.filteredParticipants = this.filterParticipants(participants, this.search);
  }

  choose(choice: string): void {
    this.selectedChoice = choice;
  }

  confirm(): void {
    if (this.selectedChoice === GUEST_CHOICE) {
      this.personalization.selectGuest();
      return;
    }
    if (this.selectedChoice) this.personalization.selectParticipant(this.selectedChoice);
  }

  secondaryAction(state: PersonalizationState): void {
    if (this.canCancel(state)) {
      this.personalization.cancelPicker();
      return;
    }
    this.personalization.skip();
  }

  canCancel(state: PersonalizationState): boolean {
    return state.mode === 'participant' || state.mode === 'guest' || state.mode === 'skipped';
  }

  initials(name: string): string {
    return name.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join('').toUpperCase();
  }

  displayName(name: string): string {
    return formatParticipantNameSurnameFirst(name);
  }

  trackParticipant(_index: number, participant: ParticipantDirectoryEntry): string {
    return participant.participantId;
  }

  @HostListener('document:keydown', ['$event'])
  onDocumentKeydown(event: KeyboardEvent): void {
    const state = this.personalization.snapshot;
    if (!state.pickerOpen) return;

    if (event.key === 'Escape') {
      if (this.canCancel(state)) this.personalization.cancelPicker();
      return;
    }

    if (event.key !== 'Tab') return;
    const focusable = Array.from(this.elementRef.nativeElement.querySelectorAll<HTMLElement>(
      'button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])',
    )).filter(element => element.offsetParent !== null);
    if (!focusable.length) return;

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && this.document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && this.document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  private filterParticipants(
    participants: ParticipantDirectoryEntry[],
    search: string,
  ): ParticipantDirectoryEntry[] {
    const query = search.trim().toLocaleLowerCase('ru');
    if (!query) return participants;
    return participants.filter(participant =>
      participant.name.toLocaleLowerCase('ru').includes(query));
  }

  private focusFirstControl(): void {
    const control = this.elementRef.nativeElement.querySelector<HTMLElement>(
      '.participant-search, .participant-option',
    );
    control?.focus();
  }
}
