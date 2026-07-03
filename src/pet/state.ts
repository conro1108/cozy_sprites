// Core stat + lifecycle engine. Pure functions, no DOM, no globals.
// Deterministic math lives in applyElapsedDecay; anything random lives in
// stepEvents and takes an injectable rng so it stays unit-testable.

import { ILLNESSES, MAX_HEARTS, emptyHidden } from "./types";
import type { AdultForm, FoodId, GameId, IllnessId, PetState, Stage } from "./types";
import { FOODS } from "./roster";
import { determineAdultForm } from "./evolution";

export { MAX_HEARTS };

// --- Timing -----------------------------------------------------------------
// Demo-tuned so the whole Egg→Adult arc is reachable in a single sitting.
// Spec values (SPEC §4) in comments; swap SPEC_TIMING in for the real cadence.
export const TIMING: Record<Exclude<Stage, "adult">, number> = {
  egg: 60_000, //  spec: 5 min
  baby: 3 * 60_000, //  spec: 30 min
  child: 5 * 60_000, //  spec: 24–48 h
  teen: 5 * 60_000, //  spec: 24–48 h
};

const STAGE_ORDER: Stage[] = ["egg", "baby", "child", "teen", "adult"];

// --- Decay rates (per millisecond) -----------------------------------------
// Demo-tuned to match the compressed stage timers above: needs must actually
// move during a ~15-minute play session or feeding/playing feels like it does
// nothing. Spec-paced values (for real-length stages): 1♥/20min and 1♥/30min.
const HUNGER_DECAY = 1 / (4 * 60_000); // ~1 heart / 4 min baseline
const HAPPINESS_DECAY = 1 / (6 * 60_000); // ~1 heart / 6 min baseline

// Baby is deliberately hectic (SPEC §4): needs drop faster.
const STAGE_DECAY_MULT: Record<Stage, number> = {
  egg: 0,
  baby: 2.2,
  child: 1.3,
  teen: 1.1,
  adult: 1,
};

const MISTAKE_INTERVAL_MS = 60_000; // one care mistake per minute of neglect

/** How long a pet survives at zero health before dying (demo-paced). */
export const DEATH_AFTER_ZERO_HEALTH_MS = 6 * 60_000;

// --- Construction -----------------------------------------------------------
export function createPet(name: string, now: number): PetState {
  return {
    name,
    createdAt: now,
    lastUpdated: now,
    stage: "egg",
    stageStartedAt: now,
    form: null,
    // Start with a little headroom so the first feed/play visibly moves a
    // heart instead of hitting an already-full meter (reads as "nothing
    // happens"). The egg freezes these until it hatches.
    hunger: 3,
    happiness: 3,
    health: 100,
    discipline: 0,
    weight: 5,
    asleep: false,
    lightsOn: true,
    sick: false,
    illness: null,
    dosesGiven: 0,
    poops: 0,
    zeroHealthMs: 0,
    deadAt: null,
    causeOfDeath: null,
    wantsAttention: false,
    fakeCall: false,
    hidden: emptyHidden(),
    recentTaps: [],
    lastIdleLineAt: 0,
  };
}

// --- Helpers ----------------------------------------------------------------
export function clampHearts(v: number): number {
  return Math.max(0, Math.min(MAX_HEARTS, v));
}
function clamp100(v: number): number {
  return Math.max(0, Math.min(100, v));
}

/** Night runs 21:00–06:59 local. Drives sleep + the Light button. */
export function isNight(now: number): boolean {
  const h = new Date(now).getHours();
  return h >= 21 || h < 7;
}

export function ageMs(state: PetState, now: number): number {
  return Math.max(0, now - state.createdAt);
}

/** A pet is "in trouble" (needs care right now) — surfaced to the UI. */
export function needsCare(state: PetState): boolean {
  return (
    state.hunger <= 0.5 ||
    state.happiness <= 0.5 ||
    state.sick ||
    state.poops > 0 ||
    (state.wantsAttention && !state.fakeCall)
  );
}

// --- The deterministic tick -------------------------------------------------
/**
 * Advance stats + life stage from lastUpdated up to `now`. The elapsed span is
 * processed in per-stage chunks so that a gap crossing a stage boundary (e.g.
 * the egg hatching into a fast-decaying baby while the tab was backgrounded)
 * applies each stage's own decay rate to its own slice of time.
 */
export function applyElapsedDecay(state: PetState, now: number): PetState {
  if (now <= state.lastUpdated) return state;
  if (state.deadAt !== null) return { ...state, lastUpdated: now };
  const s: PetState = { ...state, hidden: { ...state.hidden } };
  let cursor = s.lastUpdated;

  while (cursor < now && s.deadAt === null) {
    let segEnd = now;
    if (s.stage !== "adult") {
      const stageEnd = s.stageStartedAt + TIMING[s.stage];
      if (stageEnd < segEnd) segEnd = stageEnd;
    }
    const seg = segEnd - cursor;
    if (seg > 0) decaySegment(s, seg, segEnd);
    cursor = segEnd;
    if (s.stage !== "adult" && cursor >= s.stageStartedAt + TIMING[s.stage]) {
      advanceOne(s);
    }
  }

  if (s.deadAt === null) {
    s.asleep = isNight(now) && !s.lightsOn && s.stage !== "egg";
  }
  s.lastUpdated = now;
  return s;
}

/** Apply `seg` ms of decay at the current stage's rates. Mutates `s`. */
function decaySegment(s: PetState, seg: number, segTime: number): void {
  const night = isNight(segTime);
  const asleep = night && !s.lightsOn && s.stage !== "egg";

  const decayMult = STAGE_DECAY_MULT[s.stage] * (asleep ? 0.3 : 1);
  s.hunger = clampHearts(s.hunger - seg * HUNGER_DECAY * decayMult);
  s.happiness = clampHearts(s.happiness - seg * HAPPINESS_DECAY * decayMult);

  // Keeping the lights on at night is bad for happiness (can't sleep).
  if (night && s.lightsOn && s.stage !== "egg") {
    s.happiness = clampHearts(s.happiness - seg * HAPPINESS_DECAY * 0.5);
  }

  const minutes = seg / 60_000;
  let healthDelta = 0;
  const goodCare = s.hunger > 2 && s.happiness > 2 && s.poops === 0 && !s.sick;
  if (goodCare) healthDelta += 0.6 * minutes;
  if (s.hunger <= 0) healthDelta -= 1.2 * minutes;
  if (s.sick) healthDelta -= 1.5 * minutes;
  healthDelta -= Math.min(s.poops, 3) * 0.5 * minutes;
  s.health = clamp100(s.health + healthDelta);

  let neglect = 0;
  if (s.hunger <= 0) neglect++;
  if (s.happiness <= 0) neglect++;
  if (s.poops >= 2) neglect++;
  if (s.sick) neglect++;
  if (neglect > 0) s.hidden.careMistakes += (seg / MISTAKE_INTERVAL_MS) * neglect;

  s.weight = Math.max(1, s.weight - 0.02 * minutes);

  // Death: sustained neglect at zero health, past the egg stage. Eggs can't die.
  if (s.stage !== "egg" && s.health <= 0) {
    s.zeroHealthMs += seg;
    if (s.zeroHealthMs >= DEATH_AFTER_ZERO_HEALTH_MS) {
      s.deadAt = segTime;
      s.causeOfDeath = causeOfDeath(s);
      s.asleep = false;
      s.wantsAttention = false;
    }
  } else if (s.health > 10) {
    s.zeroHealthMs = 0; // meaningfully recovered — reset the doom clock
  }
}

/** What gets carved on the memorial. Illness wins; otherwise infer neglect. */
function causeOfDeath(s: PetState): string {
  if (s.sick && s.illness) return ILLNESSES[s.illness].label;
  if (s.sick) return "a mysterious ailment";
  if (s.hunger <= 0) return "an empty bowl";
  if (s.happiness <= 0) return "a broken heart";
  return "general neglect";
}

/** Move to the next life stage. Mutates `s`. Caller guarantees stage≠adult. */
function advanceOne(s: PetState): void {
  const cur = s.stage as Exclude<Stage, "adult">;
  const next = STAGE_ORDER[STAGE_ORDER.indexOf(cur) + 1];
  // The next stage began when this one ended, not "now".
  s.stageStartedAt = s.stageStartedAt + TIMING[cur];
  s.stage = next;
  if (next === "baby") {
    s.wantsAttention = false;
    // Baby is deliberately hectic (SPEC §4): it hatches already hungry so care
    // matters immediately and the player learns the controls right away.
    s.hunger = Math.min(s.hunger, 2);
    s.happiness = Math.min(s.happiness, 2);
  }
  if (next === "adult") s.form = determineAdultForm(s.hidden, s.health);
}

// --- Player actions ---------------------------------------------------------
export interface ActionResult {
  state: PetState;
  /** Optional signal for the UI (e.g. "disliked", "favorite", "toosick"). */
  note?: string;
}

export function feed(state: PetState, food: FoodId, now: number): ActionResult {
  let s = applyElapsedDecay(state, now);
  if (s.stage === "egg" || s.asleep || s.deadAt !== null) {
    return { state: s, note: "cant" };
  }
  s = { ...s, hidden: { ...s.hidden } };
  const def = FOODS[food];

  // Refuse proper meals when already full (classic Tamagotchi behaviour);
  // treats (cake/cube — anything with real happiness value) are always taken.
  const isTreat = def.happiness >= 0.5;
  if (!isTreat && s.hunger >= MAX_HEARTS - 0.05) {
    return { state: s, note: "full" };
  }

  let note: string | undefined;
  let happyBonus = 0;
  const fav = s.form ? favoriteFood(s.form) === food : false;
  const dis = s.form ? dislikedFood(s.form) === food : false;
  if (fav) {
    happyBonus += 1;
    note = "favorite";
  } else if (dis) {
    happyBonus -= 0.5;
    note = "disliked";
  }

  s.hunger = clampHearts(s.hunger + def.hunger);
  s.happiness = clampHearts(s.happiness + def.happiness + happyBonus);
  s.weight = s.weight + def.weight;

  if (food === "cake") {
    s.hidden.cakeEaten++;
    // Junk food nudges health down and raises sickness pressure.
    s.health = clamp100(s.health - 3);
  }
  if (food === "cube") {
    s.hidden.cubeEaten++;
    if (!note) note = "cube";
  }
  if (food === "carrot") s.health = clamp100(s.health + 4);

  return { state: s, note };
}

/** Apply the happiness reward from a finished mini-game. */
export function applyGameResult(
  state: PetState,
  game: GameId,
  won: boolean,
  now: number,
): PetState {
  let s = applyElapsedDecay(state, now);
  s = { ...s, hidden: { ...s.hidden, gamePlays: { ...s.hidden.gamePlays } } };
  s.hidden.gamePlays[game]++;
  const gain = won ? 1.5 : 0.4;
  s.happiness = clampHearts(s.happiness + gain);
  s.hunger = clampHearts(s.hunger - 0.2);
  s.weight = Math.max(1, s.weight - 0.3);
  return s;
}

export function clean(state: PetState, now: number): ActionResult {
  const s = applyElapsedDecay(state, now);
  if (s.poops === 0) return { state: s, note: "nothing" };
  return { state: { ...s, poops: 0 }, note: "cleaned" };
}

export function giveMedicine(state: PetState, now: number): ActionResult {
  let s = applyElapsedDecay(state, now);
  if (!s.sick) {
    // Medicine when not needed is a small care mistake.
    s = { ...s, hidden: { ...s.hidden, careMistakes: s.hidden.careMistakes + 1 } };
    return { state: s, note: "notneeded" };
  }
  // The plague takes two shots; everything else one (same mechanic otherwise).
  const needed = s.illness ? ILLNESSES[s.illness].doses : 1;
  const given = s.dosesGiven + 1;
  if (given < needed) {
    s = { ...s, dosesGiven: given, health: clamp100(s.health + 4) };
    if (!s.lightsOn) s.hidden = { ...s.hidden, nightCare: s.hidden.nightCare + 1 };
    return { state: s, note: "dose" };
  }
  s = { ...s, sick: false, illness: null, dosesGiven: 0, health: clamp100(s.health + 12) };
  if (!s.lightsOn) s.hidden = { ...s.hidden, nightCare: s.hidden.nightCare + 1 };
  return { state: s, note: "cured" };
}

/**
 * Discipline is correct when the pet is making a fake attention call or acting
 * out; incorrect otherwise (which dings happiness/health — SPEC §11).
 */
export function discipline(state: PetState, now: number): ActionResult {
  let s = applyElapsedDecay(state, now);
  if (s.stage === "egg" || s.stage === "baby") {
    return { state: s, note: "cant" }; // babies can't be disciplined
  }
  s = { ...s, hidden: { ...s.hidden } };
  const correct = s.wantsAttention && s.fakeCall;
  if (correct) {
    // Teen discipline carries more weight (SPEC §4).
    s.hidden.discipline += s.stage === "teen" ? 12 : 8;
    s.discipline = clamp100(s.discipline + (s.stage === "teen" ? 12 : 8));
    s.wantsAttention = false;
    s.fakeCall = false;
    return { state: s, note: "correct" };
  }
  s.hidden.careMistakes += 1;
  s.discipline = clamp100(s.discipline - 4);
  s.happiness = clampHearts(s.happiness - 0.5);
  s.health = clamp100(s.health - 2);
  return { state: s, note: "incorrect" };
}

export function toggleLight(state: PetState, now: number): PetState {
  let s = applyElapsedDecay(state, now);
  s = { ...s, lightsOn: !s.lightsOn };
  s.asleep = isNight(now) && !s.lightsOn && s.stage !== "egg";
  // Turning lights off at night to let it sleep counts toward the Ghost path.
  if (isNight(now) && !s.lightsOn) {
    s.hidden = { ...s.hidden, nightCare: s.hidden.nightCare + 1 };
  }
  return s;
}

// --- Tap interaction --------------------------------------------------------
export const TAP_WINDOW_MS = 10_000;
export const TAP_ANNOY_THRESHOLD = 5;

export interface TapResult {
  state: PetState;
  annoyed: boolean;
  /** If the pet was making a genuine call, tapping answers it. */
  answered: boolean;
}

export function tap(state: PetState, now: number): TapResult {
  const s = applyElapsedDecay(state, now);
  const recentTaps = [...s.recentTaps, now].filter(
    (t) => now - t < TAP_WINDOW_MS,
  );
  const annoyed = recentTaps.length >= TAP_ANNOY_THRESHOLD;
  let next: PetState = { ...s, recentTaps };
  let answered = false;
  if (s.wantsAttention && !s.fakeCall) {
    next = { ...next, wantsAttention: false, happiness: clampHearts(next.happiness + 0.5) };
    answered = true;
  }
  if (annoyed) {
    next.happiness = clampHearts(next.happiness - 0.2);
  }
  return { state: next, annoyed, answered };
}

// --- Stochastic events (game-loop level, rng injectable) --------------------
export interface EventResult {
  state: PetState;
  events: string[]; // e.g. ["poop", "sick", "call"]
}

/**
 * Advance random world events over `elapsed` ms. Probabilities scale with time
 * so the cadence is frame-rate independent. rng defaults to Math.random.
 */
export function stepEvents(
  state: PetState,
  elapsed: number,
  rng: () => number = Math.random,
): EventResult {
  const events: string[] = [];
  if (state.stage === "egg" || state.asleep || state.deadAt !== null) {
    return { state, events };
  }
  let s: PetState = { ...state, hidden: { ...state.hidden } };
  const perMin = elapsed / 60_000;

  // Pooping — babies poop a lot (SPEC §4).
  const poopRate = s.stage === "baby" ? 0.9 : 0.35;
  if (s.poops < 4 && rng() < poopRate * perMin) {
    s.poops++;
    events.push("poop");
  }

  // Falling ill — pressure from low health, junk food, and lingering mess.
  if (!s.sick) {
    let sickRate = 0.03;
    if (s.health < 40) sickRate += 0.15;
    if (s.poops >= 2) sickRate += 0.08;
    if (s.hidden.cakeEaten > 6) sickRate += 0.05;
    if (rng() < sickRate * perMin) {
      s.sick = true;
      s.illness = rollIllness(rng);
      s.dosesGiven = 0;
      events.push("sick");
    }
  }

  // Attention calls. From teen on, some are fake (boundary-testing, SPEC §4).
  if (!s.wantsAttention && rng() < 0.25 * perMin) {
    s.wantsAttention = true;
    s.fakeCall = (s.stage === "teen" || s.stage === "adult") && rng() < 0.5;
    events.push(s.fakeCall ? "fakecall" : "call");
  }

  return { state: s, events };
}

/** Weighted illness pick — mundane ailments common, the plague rare. */
export function rollIllness(rng: () => number = Math.random): IllnessId {
  const table: [IllnessId, number][] = [
    ["sniffles", 0.3],
    ["dysentery", 0.25],
    ["goblinflu", 0.2],
    ["vapors", 0.15],
    ["plague", 0.1],
  ];
  let r = rng();
  for (const [id, w] of table) {
    r -= w;
    if (r < 0) return id;
  }
  return "sniffles";
}

// --- Food preference lookups (re-exported for convenience) ------------------
export function favoriteFood(form: AdultForm): FoodId {
  return ADULT_FOOD[form].favorite;
}
export function dislikedFood(form: AdultForm): FoodId | null {
  return ADULT_FOOD[form].disliked;
}

const ADULT_FOOD: Record<AdultForm, { favorite: FoodId; disliked: FoodId | null }> = {
  dog: { favorite: "burger", disliked: "cube" },
  blob: { favorite: "cake", disliked: "carrot" },
  gremlin: { favorite: "cube", disliked: null },
  scholar: { favorite: "carrot", disliked: "cake" },
  office: { favorite: "noodles", disliked: "cube" },
  menace: { favorite: "cake", disliked: "burger" },
  ghost: { favorite: "cube", disliked: "burger" },
};
