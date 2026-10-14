import { BALL_R, type Difficulty, type InputDevice } from "../constants";
import type { PlayerEntity, Team, Vec } from "../types";
import type { TeamData } from "../teams/types";
import type { MatchEvent, MatchEventKind } from "../contracts";
import { makePlayer } from "./factory";

export class MatchState {
  difficulty: Difficulty = "media";
  device: InputDevice | null = null;
  lastKickKind: MatchEventKind = "pass";
  keys = new Set<string>();
  justPressed: string[] = [];
  justReleased: string[] = [];
  chargeKey: string | null = null;
  chargeTime = 0;
  chargeLofted = false;
  bufferTimer = 0;
  kickPending = false;
  ball = { x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, r: BALL_R };
  homePlayers: PlayerEntity[] = [];
  awayPlayers: PlayerEntity[] = [];
  controlledId = "";
  get controlled(): PlayerEntity {
    const p = this.playerById.get(this.controlledId);
    if (!p) throw new Error("Missing controlled player");
    return p;
  }
  set controlled(p: PlayerEntity) {
    this.controlledId = p.id;
  }
  switchHintId: string | null = null;
  get switchHint(): PlayerEntity | null {
    return this.switchHintId
      ? (this.playerById.get(this.switchHintId) ?? null)
      : null;
  }
  set switchHint(p: PlayerEntity | null) {
    this.switchHintId = p?.id ?? null;
  }
  awayActiveId: string | null = null;
  get awayActive(): PlayerEntity | null {
    return this.awayActiveId
      ? (this.playerById.get(this.awayActiveId) ?? null)
      : null;
  }
  set awayActive(p: PlayerEntity | null) {
    this.awayActiveId = p?.id ?? null;
  }
  ownerId: string | null = null;
  get owner(): PlayerEntity | null {
    return this.ownerId ? (this.playerById.get(this.ownerId) ?? null) : null;
  }
  set owner(p: PlayerEntity | null) {
    this.ownerId = p?.id ?? null;
  }
  lastKickerId: string | null = null;
  get lastKicker(): PlayerEntity | null {
    return this.lastKickerId
      ? (this.playerById.get(this.lastKickerId) ?? null)
      : null;
  }
  set lastKicker(p: PlayerEntity | null) {
    this.lastKickerId = p?.id ?? null;
  }
  kickerLock = 0;
  passReceiverId: string | null = null;
  get passReceiver(): PlayerEntity | null {
    return this.passReceiverId
      ? (this.playerById.get(this.passReceiverId) ?? null)
      : null;
  }
  set passReceiver(p: PlayerEntity | null) {
    this.passReceiverId = p?.id ?? null;
  }
  aerialReceiverId: string | null = null;
  get aerialReceiver(): PlayerEntity | null {
    return this.aerialReceiverId
      ? (this.playerById.get(this.aerialReceiverId) ?? null)
      : null;
  }
  set aerialReceiver(p: PlayerEntity | null) {
    this.aerialReceiverId = p?.id ?? null;
  }
  cpuDecision = 0;
  stealProtect = 0;
  dispossessedId: string | null = null;
  get dispossessed(): PlayerEntity | null {
    return this.dispossessedId
      ? (this.playerById.get(this.dispossessedId) ?? null)
      : null;
  }
  set dispossessed(p: PlayerEntity | null) {
    this.dispossessedId = p?.id ?? null;
  }
  dispossessedTimer = 0;
  tackleTimer = 0;
  tackleCooldown = 0;
  tackleDir: Vec = { x: 1, y: 0 };
  slideCooldown = 0;
  cpuTackleCd = 0;
  jostle = 0;
  nextKickKind: "pass" | "shot" = "pass";
  ballFree = 0;
  gkRush = 0;
  lastTouchTeam: Team | null = null;
  throwInTakerId: string | null = null;
  get throwInTaker(): PlayerEntity | null {
    return this.throwInTakerId
      ? (this.playerById.get(this.throwInTakerId) ?? null)
      : null;
  }
  set throwInTaker(p: PlayerEntity | null) {
    this.throwInTakerId = p?.id ?? null;
  }
  homeScore = 0;
  awayScore = 0;
  elapsed = 0;
  message = "";
  messageTimer = 0;
  freeze = 0;
  outOfPlay = 0;
  pendingRestart: {
    team: Team;
    spotX: number;
    spotY: number;
    label: string;
    takerIsGK: boolean;
    isThrowIn: boolean;
  } | null = null;
  refusedPasses = new Set<string>();
  celebration = 0;
  celebrateTeam: Team | null = null;
  pendingKickoff: Team | null = null;
  scorerId: string | null = null;
  get scorer(): PlayerEntity | null {
    return this.scorerId ? (this.playerById.get(this.scorerId) ?? null) : null;
  }
  set scorer(p: PlayerEntity | null) {
    this.scorerId = p?.id ?? null;
  }
  netRipple = { left: 0, right: 0 };
  offsideFlags = new Set<string>();
  markAssign = new Map<string, string>();
  markTimer = 0;
  attackRole = new Map<string, "run" | "short" | "width" | "hold">();
  gkHoldTimer = 0;
  gkHandling = false;
  playerById = new Map<string, PlayerEntity>();
  time = 0;
  tick = 0;
  dt = 1 / 60;
  moveInput: Vec = { x: 0, y: 0 };
  events: MatchEvent[] = [];
  eventSequence = 0;
  receptionTime = 0;
  constructor(
    readonly homeTeam: TeamData,
    readonly awayTeam: TeamData,
    readonly practice: boolean,
    readonly random: () => number,
  ) {
    this.homePlayers = homeTeam.players.map((p, i) =>
      makePlayer(this, "home", p.pos, i),
    );
    this.awayPlayers = awayTeam.players.map((p, i) =>
      makePlayer(this, "away", { x: 1 - p.pos.x, y: p.pos.y }, i),
    );
    this.playerById = new Map(
      [...this.homePlayers, ...this.awayPlayers].map((p) => [p.id, p]),
    );
    this.controlled = this.homePlayers[homeTeam.kickoffFwd];
  }
}
