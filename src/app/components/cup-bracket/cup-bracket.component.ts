import {
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
  ViewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { CompetitionCup } from '../../competition/models/competition.models';
import {
  buildCupBracketViewModel,
  CupBracketEdgeView,
  CupBracketNodeView,
  CupBracketRoundView,
  CupBracketSlotView,
  CupBracketViewModel,
} from '../../competition/domain/cup-bracket';
import { IProfileDetails } from '../../models/domain';
import { MatchCenterSelection } from '../../match-center/match-center.models';
import { PersonalizedParticipantDirective } from '../../directives/personalized-participant.directive';

@Component({
  selector: 'app-cup-bracket',
  standalone: true,
  imports: [CommonModule, PersonalizedParticipantDirective],
  templateUrl: './cup-bracket.component.html',
  styleUrls: ['./cup-bracket.component.scss'],
})
export class CupBracketComponent implements OnChanges {
  @Input({ required: true }) cup!: CompetitionCup;
  @Input() profiles: IProfileDetails[] = [];
  @Input() lastTour = 1;
  @Input() showMartinLeague = false;
  @Output() matchOpen = new EventEmitter<MatchCenterSelection>();

  @ViewChild('desktopViewport') private desktopViewport?: ElementRef<HTMLElement>;

  viewModel: CupBracketViewModel = buildCupBracketViewModel({
    matchesTours: [],
    matches: [],
  });
  selectedNodeId = '';
  activeMobileRoundIndex = 0;

  private profileById = new Map<string, IProfileDetails>();

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['profiles']) {
      this.profileById = new Map(this.profiles.map(profile => [profile.id, profile]));
    }
    if (changes['cup']) {
      this.viewModel = buildCupBracketViewModel(this.cup);
      if (!this.viewModel.nodes.some(node => node.id === this.selectedNodeId)) {
        this.selectedNodeId = '';
      }
    }
    if (changes['cup'] || changes['lastTour']) {
      const currentRound = this.viewModel.rounds
        .filter(round => round.tour <= this.lastTour)
        .at(-1);
      this.activeMobileRoundIndex = currentRound?.index ?? 0;
    }
  }

  get selectedNode(): CupBracketNodeView | undefined {
    return this.viewModel.nodes.find(node => node.id === this.selectedNodeId);
  }

  get activeMobileRound(): CupBracketRoundView | undefined {
    return this.viewModel.rounds[this.activeMobileRoundIndex];
  }

  get selectedTransitions(): CupBracketEdgeView[] {
    return this.outgoingEdges(this.selectedNodeId);
  }

  outgoingEdges(node: CupBracketNodeView | string): CupBracketEdgeView[] {
    const nodeId = typeof node === 'string' ? node : node.id;
    return this.viewModel.edges.filter(edge => edge.from === nodeId);
  }

  selectNode(node: CupBracketNodeView): void {
    this.selectedNodeId = node.id;
  }

  handleNodeKeydown(event: KeyboardEvent, node: CupBracketNodeView): void {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    this.selectNode(node);
  }

  selectMobileRound(index: number): void {
    this.activeMobileRoundIndex = index;
  }

  openMatch(event: Event, node: CupBracketNodeView): void {
    event.stopPropagation();
    if (!node.match || !node.home.profileId || !node.away.profileId) return;
    this.matchOpen.emit({
      match: node.match,
      tour: node.match.decidingTour ?? node.tour,
    });
  }

  focusTarget(edge: CupBracketEdgeView, mobile = false): void {
    const target = this.nodeFor(edge.to);
    if (!target) return;
    this.selectedNodeId = target.id;
    if (mobile) {
      this.activeMobileRoundIndex = target.roundIndex;
      return;
    }
    setTimeout(() => {
      const element = this.desktopViewport?.nativeElement
        .querySelector<HTMLElement>(`[data-node-id="${target.id}"]`);
      element?.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
      element?.focus({ preventScroll: true });
    });
  }

  nodeFor(id: string): CupBracketNodeView | undefined {
    return this.viewModel.nodes.find(node => node.id === id);
  }

  roundX(round: CupBracketRoundView): number {
    return round.nodes[0]?.x ?? 0;
  }

  isSelected(node: CupBracketNodeView): boolean {
    return node.id === this.selectedNodeId;
  }

  isSelectedTarget(node: CupBracketNodeView): boolean {
    return this.selectedTransitions.some(edge => edge.to === node.id);
  }

  isHighlightedEdge(edge: CupBracketEdgeView): boolean {
    return edge.from === this.selectedNodeId;
  }

  isDimmedEdge(edge: CupBracketEdgeView): boolean {
    return Boolean(this.selectedNodeId) && !this.isHighlightedEdge(edge);
  }

  profile(slot: CupBracketSlotView): IProfileDetails | undefined {
    return slot.profileId ? this.profileById.get(slot.profileId) : undefined;
  }

  teamTitle(slot: CupBracketSlotView): string {
    return this.profile(slot)?.team.title || slot.placeholder;
  }

  participantName(slot: CupBracketSlotView): string {
    return this.profile(slot)?.name || '';
  }

  teamLogo(slot: CupBracketSlotView): string {
    return this.profile(slot)?.logo || 'assets/logos/default.png';
  }

  isMartinMember(slot: CupBracketSlotView): boolean {
    return Boolean(this.showMartinLeague && this.profile(slot)?.isMartin === 1);
  }

  isWinner(node: CupBracketNodeView, slot: CupBracketSlotView): boolean {
    if (!node.match || !slot.profileId || !node.match.result) return false;
    return node.match.result === 1
      ? node.match.home === slot.profileId
      : node.match.away === slot.profileId;
  }

  scoreFor(node: CupBracketNodeView, slot: CupBracketSlotView): number | string {
    if (!node.match || !slot.profileId) return '–';
    const score = node.match.home === slot.profileId
      ? node.match.home_score
      : node.match.away_score;
    return score ?? '–';
  }

  nodeLabel(node: CupBracketNodeView): string {
    return `${node.roundTitle} · ${node.laneLabel} · пара ${node.pairNumber}`;
  }

  transitionLabel(edge: CupBracketEdgeView): string {
    const target = this.nodeFor(edge.to);
    if (!target) return '';
    const outcome = edge.outcome === 'winner' ? 'Победитель' : 'Проигравший';
    return `${outcome} → ${this.nodeLabel(target)}`;
  }

  nodeAriaLabel(node: CupBracketNodeView): string {
    return `${this.nodeLabel(node)}. ${this.teamTitle(node.home)} — ${this.teamTitle(node.away)}`;
  }

  trackNode(_: number, node: CupBracketNodeView): string {
    return node.id;
  }

  trackEdge(_: number, edge: CupBracketEdgeView): string {
    return edge.id;
  }

  trackRound(_: number, round: CupBracketRoundView): number {
    return round.index;
  }
}
