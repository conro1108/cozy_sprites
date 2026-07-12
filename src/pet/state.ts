// Core stat + lifecycle engine. Pure functions, no DOM, no globals.
// Deterministic math lives in applyElapsedDecay; anything random lives in
// stepEvents and takes an injectable rng so it stays unit-testable.
//
// REAL-CLOCK MODE: the pet lives on the wall clock. It sleeps 8pm–8am local
// time, stages take real days, and the care cadence is tuned around three
// player archetypes — loving (hourly visits), average (every 2–3h), and bare
// minimum (every ~6h). The design rule that shapes most of the night math:
// NOTHING CATASTROPHIC HAPPENS OVERNIGHT. Penalties, starvation drain, and the
// death clock all pause while the world is dark, so no one wakes up to a
// corpse. The one exception is untreated illness, which keeps draining at half
// pace — ignoring a sick pet at bedtime means a dramatic morning, not a grave.

import { ILLNESSES, MAX_HEARTS, emptyHidden } from "./types";
import type {
  AdultForm,
  AttentionWant,
  FoodId,
  GameId,
  IllnessId,
  PetState,
  Stage,
} from "./types";
import { FOODS } from "./roster";
import { determineAdultForm } from "./evolution";
import { cubeHumCredit } from "./games";

export { MAX_HEARTS };

const HOUR = 3_600_000;

// --- Timing -----------------------------------------------------------------
// Awake-time budgets per stage (sleep doesn't count, see SLEEP_AGE_RATE).
// Egg + baby are same-sitting: you hatch it, you supervise its hectic infancy.
// Child/teen are measured in awake-days (12h of awake time ≈ one real day).
export const TIMING: Record<Exclude<Stage, "adult">, number> = {
  egg: 60_000, // 1 min — it hatches while you watch
  baby: 30 * 60_000, // 30 min — hatch-day supervision, deliberately needy
  child: 24 * HOUR, // 2 awake-days
  teen: 36 * HOUR, // 3 awake-days
};

const STAGE_ORDER: Stage[] = ["egg", "baby", "child", "teen", "adult"];

/**
 * Fraction of elapsed time that counts toward growing up while ASLEEP.
 *   0   → sleep freezes aging entirely (a pet only grows while awake).
 * A pet sleeps ~12h/day, so this governs whether roughly half its life ages.
 */
export const SLEEP_AGE_RATE = 0;

// --- Decay rates (per millisecond, awake daytime baseline) -------------------
// A full energy meter lasts ~3.5h awake; happiness ~2.5h. Tuned so a loving
// player (hourly) never sees zero, an average one (2–3h) grazes it harmlessly,
// and a bare-minimum one (6h) eats about an hour of starvation penalty per gap.
const ENERGY_DECAY = MAX_HEARTS / (3.5 * HOUR);
const HAPPINESS_DECAY = MAX_HEARTS / (2.5 * HOUR);

// Baby is deliberately relentless: a full heart (of energy or happiness) burns
// off in about twenty seconds awake, so hatch-day is nonstop care.
const STAGE_ENERGY_MULT: Record<Stage, number> = {
  egg: 0,
  baby: 157.5,
  child: 2.5,
  teen: 1.1,
  adult: 1,
};
const STAGE_HAPPY_MULT: Record<Stage, number> = {
  egg: 0,
  baby: 112.5,
  child: 2.5,
  teen: 1.1,
  adult: 1,
};

// Sleep nearly freezes the meters (sleeping is contentment); energy still
// creeps so the 8am breakfast is a ritual, not a rescue. A pet kept awake at
// night decays slower than by day but pays a health toll for the lost sleep.
const SLEEP_ENERGY_MULT = 0.12;
const SLEEP_HAPPY_MULT = 0.05;
const NIGHT_AWAKE_MULT = 0.3;

// --- Grace windows -----------------------------------------------------------
// A stat sitting at zero is only NEGLECT once it's been there a while. This is
// what separates the average player (bowl briefly empty, no harm done) from
// the bare-minimum one (empty for hours — that's on you).
export const STARVING_GRACE_MS = 1.5 * HOUR;
export const SAD_GRACE_MS = 1 * HOUR;

// --- Health economy (points per awake daytime hour, 0..100 scale) -----------
const GOOD_CARE_REGEN = 5;
const STARVE_DRAIN = 15;
const POOP_DRAIN = 3; // per mess, up to 3
const NIGHT_AWAKE_DRAIN = 1; // being up all night is slightly bad for you

// Weight thresholds — see feed()/applyGameResult(). Baseline weight is ~5.
export const OVERWEIGHT = 12; // raises sickness pressure, dulls game joy
export const UNDERWEIGHT = 2.5; // blocks health regen until fed back up
const WEIGHT_DRIFT_PER_HOUR = 0.15; // daytime metabolism, at adult tempo

// Babies and children run hot — they digest (and mess) faster, and burn off
// meals faster too, matching how much more often their energy/happiness
// decay forces them to be fed. Adults are sedate. Without this, a stage that
// eats more often than an adult (to keep pace with its faster hunger) would
// gain weight far quicker than the flat drift below could ever remove.
const STAGE_METABOLISM_MULT: Record<Stage, number> = {
  egg: 0,
  baby: 2.2,
  child: 2.5,
  teen: 1.1,
  adult: 1,
};

// Every game costs energy and burns weight on top of its happiness reward.
// Fetch is the outlier — actual running, not a card guess or a chat — so it
// costs more of both.
const BASE_GAME_EXERTION = { energy: 0.2, weight: 0.3 };
const GAME_EXERTION: Partial<Record<GameId, { energy: number; weight: number }>> = {
  fetch: { energy: 0.3, weight: 0.6 },
};

// Poop is on a regular per-stage schedule now, not fiber-gated — baby is a
// real shitter, everyone else goes at a sedate, roughly-steady clip. Fiber no
// longer decides IF a poop happens, only how good it is (see feed()/below).
const STAGE_POOP_PER_HOUR: Record<Stage, number> = {
  egg: 0,
  baby: 24,
  child: 0.8,
  teen: 0.4,
  adult: 0.35,
};
// Dysentery is the runs — floods the floor far faster than nature's pace.
const DYSENTERY_POOP_BONUS_PER_HOUR = 1.5;

// Diet quality, tracked as an exponential moving average of fiber eaten so it
// drifts with recent meals instead of filling/draining a hidden buffer. Starts
// at a neutral baseline (~soup/burger) so an unfed pet's first poop isn't
// unearned bad luck.
const FIBER_EMA_ALPHA = 0.35;
export const NEUTRAL_FIBER_LEVEL = 0.3;
const FIBER_GOOD_THRESHOLD = 0.4;
const FIBER_BAD_THRESHOLD = 0.2;

// Effects when a poop actually lands — good digestion trims a little weight
// and nudges health up; bad digestion (junk-heavy diet, or dysentery, which
// always counts as bad) costs more weight, hurts more, and lingers as a
// sickness risk until swept (see hasBadPoop, clean()).
const GOOD_POOP_WEIGHT_LOSS = 0.15;
const GOOD_POOP_HEALTH_GAIN = 1;
const BAD_POOP_WEIGHT_LOSS = 0.5;
const BAD_POOP_HEALTH_LOSS = 4;
const BAD_POOP_SICK_BONUS = 0.03;

/** Most messes that can pile up on the floor before the game stops adding more. */
const MAX_POOPS = 8;

const MISTAKE_INTERVAL_MS = 30 * 60_000; // one care mistake per 30min of neglect

/** How long a pet survives at zero health before dying. The clock only runs in
 *  daylight — combined with the drain rates above, total abandonment kills in
 *  roughly 10–12 awake hours, never overnight. */
export const DEATH_AFTER_ZERO_HEALTH_MS = 2 * HOUR;

// --- Night ledger ------------------------------------------------------------
export const ALL_NIGHTER_MS = 10 * HOUR; // awake ≥10h of the night = a mistake
const FULL_NIGHT_SLEEP_MS = 8 * HOUR;
const BEDTIME_BONUS = 8; // health, for a full night's sleep gone to bed well

// --- Attention calls ----------------------------------------------------------
/** An unanswered call goes stale after this long. A genuine one that expires
 *  is a care mistake (it needed you); a fake one just gives up on the bit. */
export const CALL_EXPIRE_MS = 30 * 60_000;
// Rare and brief, by design — a real event to catch, not a state to manage.
export const ZOOMIES_DURATION_MS = 25 * 1000;
const ZOOMIES_PER_HOUR = 0.06; // roughly once every ~16h of happy, healthy, awake time

// --- Illness particulars ------------------------------------------------------
export const NAP_CURE_MS = 1 * HOUR; // the vapors: a proper daytime lie-down
export const DOSE_SPACING_MS = 1 * HOUR; // plague's second shot needs an hour

// --- Retirement ---------------------------------------------------------------
// Adults accrue awake-daytime toward retirement, scaled by how they're doing:
// a thriving pet's clock runs slow (~10+ awake-days of adulthood), a scruffy
// one's runs fast (~5). At RESTLESS the dialogue turns wistful; at full it's
// ready and waits to be walked to the farm; left waiting long enough, it slips
// away by itself at dawn, gracefully.
export const ADULT_LIFESPAN_MS = 7 * 12 * HOUR; // 7 awake-days at pace 1×
const RESTLESS_FRACTION = 0.7;
export const AUTO_LEAVE_EXTRA_MS = 18 * HOUR; // 1.5 awake-days of waiting

export type RetirementPhase = "none" | "restless" | "ready";

export function retirementPhase(s: PetState): RetirementPhase {
  if (s.stage !== "adult" || s.deadAt !== null || s.departedAt !== null) return "none";
  if (s.adultLifeMs >= ADULT_LIFESPAN_MS) return "ready";
  if (s.adultLifeMs >= ADULT_LIFESPAN_MS * RESTLESS_FRACTION) return "restless";
  return "none";
}

/** How fast the retirement clock runs right now. Thriving slows it down —
 *  "healthy happy fellas stick around longer". */
function retirementPace(s: PetState): number {
  if (s.health >= 80 && s.happiness >= 3) return 0.65;
  if (s.health < 40 || s.happiness < 1) return 1.4;
  return 1;
}

// --- Construction -----------------------------------------------------------
export function createPet(name: string, now: number): PetState {
  return {
    name,
    createdAt: now,
    lastUpdated: now,
    stage: "egg",
    stageStartedAt: now,
    stageElapsedMs: 0,
    form: null,
    // Start with a little headroom so the first feed/play visibly moves a
    // heart instead of hitting an already-full meter (reads as "nothing
    // happens"). The egg freezes these until it hatches.
    energy: 3,
    happiness: 3,
    health: 100,
    discipline: 0,
    weight: 5,
    asleep: false,
    lightsOn: true,
    sick: false,
    illness: null,
    dosesGiven: 0,
    lastDoseAt: null,
    illnessMs: 0,
    napMs: 0,
    poops: 0,
    fiberLevel: NEUTRAL_FIBER_LEVEL,
    hasBadPoop: false,
    energyZeroMs: 0,
    happinessZeroMs: 0,
    nightAwakeMs: 0,
    nightSleepMs: 0,
    zeroHealthMs: 0,
    deadAt: null,
    causeOfDeath: null,
    adultLifeMs: 0,
    departedAt: null,
    wantsAttention: false,
    fakeCall: false,
    attentionWant: null,
    callStartedAt: null,
    zoomies: false,
    zoomiesStartedAt: null,
    hidden: emptyHidden(),
    recentTaps: [],
    recentPats: [],
    tapStreak: 0,
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

// Real clock: night runs 8pm–8am LOCAL time. Drives sleep, the Light button,
// the scene sky, and every "nothing bad happens overnight" rule in this file.
export const NIGHT_START_HOUR = 20;
export const NIGHT_END_HOUR = 8;

/** Whether it's night. Drives sleep, the Light button, and the scene sky. */
export function isNight(now: number): boolean {
  const h = new Date(now).getHours();
  return h >= NIGHT_START_HOUR || h < NIGHT_END_HOUR;
}

/** The next dusk or dawn strictly after `t`. Lets applyElapsedDecay cut the
 *  elapsed span at day/night edges so each chunk is uniformly awake or asleep
 *  (and thus ages at one constant rate). Built with the Date constructor so
 *  local DST shifts land where the wall clock says they should. */
function nextDayNightBoundary(t: number): number {
  const d = new Date(t);
  const h = d.getHours();
  // Before 8am → today's dawn; 8am–7:59pm → today's dusk; 8pm+ → tomorrow's
  // dawn (hour 32 rolls over correctly in the Date constructor).
  const boundaryHour =
    h < NIGHT_END_HOUR ? NIGHT_END_HOUR : h < NIGHT_START_HOUR ? NIGHT_START_HOUR : NIGHT_END_HOUR + 24;
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), boundaryHour, 0, 0, 0).getTime();
}

export function ageMs(state: PetState, now: number): number {
  return Math.max(0, now - state.createdAt);
}

/** A pet is "in trouble" (needs care right now) — surfaced to the UI. */
export function needsCare(state: PetState): boolean {
  return (
    state.energy <= 0.5 ||
    state.happiness <= 0.5 ||
    state.sick ||
    state.poops > 0 ||
    (state.wantsAttention && !callUnjustified(state))
  );
}

/** Too weak for mini-games right now. The UI checks this before offering a
 *  game; applyGameResult enforces it as the authoritative backstop. */
export function tooSickToPlay(state: PetState): boolean {
  return state.sick && state.illness !== null && ILLNESSES[state.illness].blocksPlay;
}

// --- The deterministic tick -------------------------------------------------
/** Upper bound on one decay chunk. Keeps the grace-window accumulators and
 *  drain transitions honest during long offline catch-ups (a 3-day absence is
 *  ~300 cheap iterations, not one 72h mega-step). */
const MAX_SEG_MS = 15 * 60_000;

/**
 * Advance stats + life stage from lastUpdated up to `now`. The elapsed span is
 * processed in chunks that break at stage boundaries, day/night edges, and
 * MAX_SEG_MS, so each chunk is uniform in stage and awake/asleep state. Aging
 * is an awake-time accumulator: awake time counts at 1×, asleep at
 * SLEEP_AGE_RATE — a sleeping pet doesn't grow.
 */
export function applyElapsedDecay(state: PetState, now: number): PetState {
  if (now <= state.lastUpdated) return state;
  if (state.deadAt !== null || state.departedAt !== null) {
    return { ...state, lastUpdated: now };
  }
  const wasAsleep = state.asleep;
  const s: PetState = { ...state, hidden: { ...state.hidden } };
  let cursor = s.lastUpdated;

  // Legacy saves: an in-flight call from before call expiry existed starts its
  // clock now rather than being judged retroactively.
  if (s.wantsAttention && s.callStartedAt === null) s.callStartedAt = cursor;

  while (cursor < now && s.deadAt === null && s.departedAt === null) {
    let segEnd = Math.min(now, cursor + MAX_SEG_MS);

    // 1) Cut at the next day/night edge so the chunk is uniformly awake or
    //    asleep. Sample isNight at the START — segEnd may land exactly on an
    //    edge where isNight flips, which would misclassify the chunk.
    const boundary = nextDayNightBoundary(cursor);
    if (boundary < segEnd) segEnd = boundary;
    const night = isNight(cursor);
    const asleep = night && !s.lightsOn && s.stage !== "egg";
    const ageRate = asleep ? SLEEP_AGE_RATE : 1;

    // 2) Cut where this stage's awake-time budget runs out, so the overshoot
    //    decays at the NEXT stage's rate. At ageRate 0 the budget never
    //    depletes within an asleep chunk, so there's nothing to cut.
    if (s.stage !== "adult" && ageRate > 0) {
      const remaining = TIMING[s.stage] - s.stageElapsedMs;
      const advanceAt = cursor + remaining / ageRate;
      if (advanceAt < segEnd) segEnd = advanceAt;
    }

    const seg = segEnd - cursor;
    if (seg > 0) {
      decaySegment(s, seg, segEnd, night);
      if (s.stage !== "adult") s.stageElapsedMs += seg * ageRate;
    }
    cursor = segEnd;

    // Stale attention call: a genuine ask that timed out is a care mistake;
    // a fake one just gives up the bit for free.
    if (
      s.wantsAttention &&
      s.callStartedAt !== null &&
      cursor - s.callStartedAt >= CALL_EXPIRE_MS
    ) {
      if (!s.fakeCall) s.hidden.careMistakes += 1;
      clearCall(s);
    }

    // Zoomies run their course with no penalty — it's just over.
    if (
      s.zoomies &&
      s.zoomiesStartedAt !== null &&
      cursor - s.zoomiesStartedAt >= ZOOMIES_DURATION_MS
    ) {
      s.zoomies = false;
      s.zoomiesStartedAt = null;
    }

    // A night chunk that ran all the way to its boundary just hit dawn.
    if (night && cursor === boundary && cursor <= now) {
      dawnHook(s, cursor);
    }

    if (s.stage !== "adult" && s.stageElapsedMs >= TIMING[s.stage]) {
      advanceOne(s, segEnd);
    }
  }

  if (s.deadAt === null && s.departedAt === null) {
    const stillNight = isNight(now);
    // Dawn: nobody relights the lantern by hand every morning — it comes back
    // on by itself, and that's what wakes it up.
    if (wasAsleep && !stillNight) s.lightsOn = true;
    s.asleep = stillNight && !s.lightsOn && s.stage !== "egg";
  }
  s.lastUpdated = now;
  return s;
}

/** Settle the night's accounts. Runs exactly once per dawn crossing. */
function dawnHook(s: PetState, at: number): void {
  if (s.stage !== "egg" && s.deadAt === null) {
    // Kept up all night — whoever left the lantern burning owns this one.
    if (s.nightAwakeMs >= ALL_NIGHTER_MS) {
      s.hidden.careMistakes += 1;
    }
    // A full night's sleep, gone to bed fed / clean / well: wake up restored.
    if (
      s.nightSleepMs >= FULL_NIGHT_SLEEP_MS &&
      !s.sick &&
      s.poops === 0 &&
      s.energy > 0.5
    ) {
      s.health = clamp100(s.health + BEDTIME_BONUS);
    }
    // A ready adult that's been kept waiting long enough leaves with the
    // sunrise. Gently. It left a note.
    if (
      s.stage === "adult" &&
      s.departedAt === null &&
      s.adultLifeMs >= ADULT_LIFESPAN_MS + AUTO_LEAVE_EXTRA_MS
    ) {
      s.departedAt = at;
      s.asleep = false;
      clearCall(s);
    }
  }
  s.nightAwakeMs = 0;
  s.nightSleepMs = 0;
}

/** Wipe any active attention call. Mutates `s`. */
function clearCall(s: PetState): void {
  s.wantsAttention = false;
  s.fakeCall = false;
  s.attentionWant = null;
  s.callStartedAt = null;
}

/** Cure the current illness (medicine, nap, or time) with a health bump. */
function cureIllness(s: PetState, healthBonus: number): void {
  s.sick = false;
  s.illness = null;
  s.dosesGiven = 0;
  s.lastDoseAt = null;
  s.illnessMs = 0;
  if (healthBonus > 0) s.health = clamp100(s.health + healthBonus);
}

/** Apply `seg` ms of decay at the current stage's rates. Mutates `s`. `night`
 *  is precomputed by the caller (sampled at the chunk's start, since the chunk
 *  is uniform in day/night) — do NOT re-derive it from segTime, which may sit
 *  on an edge. */
function decaySegment(s: PetState, seg: number, segTime: number, night: boolean): void {
  const asleep = night && !s.lightsOn && s.stage !== "egg";
  const day = !night;
  const hours = seg / HOUR;
  const fx = s.sick && s.illness ? ILLNESSES[s.illness] : null;

  // --- Meters ---------------------------------------------------------------
  let energyMult = STAGE_ENERGY_MULT[s.stage];
  let happyMult = STAGE_HAPPY_MULT[s.stage] * (fx ? fx.happinessDecayMult : 1);
  if (asleep) {
    energyMult *= SLEEP_ENERGY_MULT;
    happyMult *= SLEEP_HAPPY_MULT;
  } else if (night) {
    energyMult *= NIGHT_AWAKE_MULT;
    happyMult *= NIGHT_AWAKE_MULT;
  }
  s.energy = clampHearts(s.energy - seg * ENERGY_DECAY * energyMult);
  s.happiness = clampHearts(s.happiness - seg * HAPPINESS_DECAY * happyMult);

  // --- Zero-stat grace clocks (daytime only; night is quiet time) -----------
  if (day && s.stage !== "egg") {
    s.energyZeroMs = s.energy <= 0 ? s.energyZeroMs + seg : 0;
    s.happinessZeroMs = s.happiness <= 0 ? s.happinessZeroMs + seg : 0;
  } else {
    if (s.energy > 0) s.energyZeroMs = 0;
    if (s.happiness > 0) s.happinessZeroMs = 0;
  }

  // --- Illness bookkeeping ---------------------------------------------------
  if (fx && day) {
    s.illnessMs += seg;
    if (fx.selfResolveMs !== null && s.illnessMs >= fx.selfResolveMs) {
      cureIllness(s, 0); // the sniffles pass on their own
    }
  }
  // Daytime lights-off is a nap; a proper one shakes off the vapors.
  if (day && !s.lightsOn && s.stage !== "egg") {
    s.napMs += seg;
    if (s.sick && s.illness && ILLNESSES[s.illness].napCure && s.napMs >= NAP_CURE_MS) {
      cureIllness(s, 6);
    }
  } else {
    s.napMs = 0;
  }

  // --- Health ----------------------------------------------------------------
  // Re-derive sickness: the bookkeeping above may have just cured it.
  const fx2 = s.sick && s.illness ? ILLNESSES[s.illness] : null;
  let healthDelta = 0;
  if (day) {
    const starving = s.energyZeroMs > STARVING_GRACE_MS;
    const goodCare =
      s.energy > 2 &&
      s.happiness > 2 &&
      s.poops === 0 &&
      !s.sick &&
      s.weight > UNDERWEIGHT;
    if (goodCare) healthDelta += GOOD_CARE_REGEN * hours;
    if (starving) healthDelta -= STARVE_DRAIN * hours;
    healthDelta -= Math.min(s.poops, 3) * POOP_DRAIN * hours;
    if (fx2) healthDelta -= fx2.drainPerHour * hours;
  } else {
    // Overnight: only illness (at half pace) and lost sleep touch health.
    if (fx2) healthDelta -= (fx2.drainPerHour / 2) * hours;
    if (!asleep && s.stage !== "egg") healthDelta -= NIGHT_AWAKE_DRAIN * hours;
  }
  s.health = clamp100(s.health + healthDelta);

  // --- Care mistakes (daytime neglect; the all-nighter is charged at dawn) ---
  if (day && s.stage !== "egg") {
    let neglect = 0;
    if (s.energyZeroMs > STARVING_GRACE_MS) neglect++;
    if (s.happinessZeroMs > SAD_GRACE_MS) neglect++;
    if (s.poops >= 2) neglect++;
    if (fx2 && fx2.neglect) neglect++;
    if (neglect > 0) s.hidden.careMistakes += (seg / MISTAKE_INTERVAL_MS) * neglect;
  }

  // --- Night ledger, metabolism, retirement ----------------------------------
  if (night && s.stage !== "egg") {
    if (asleep) s.nightSleepMs += seg;
    else s.nightAwakeMs += seg;
  }
  if (day) {
    s.weight = Math.max(
      1,
      s.weight - WEIGHT_DRIFT_PER_HOUR * STAGE_METABOLISM_MULT[s.stage] * hours,
    );
    if (s.stage === "adult") s.adultLifeMs += seg * retirementPace(s);
  }

  // --- Death: sustained neglect at zero health, past the egg stage. Eggs
  // can't die, and the doom clock only runs in daylight — see file header.
  if (s.stage !== "egg" && s.health <= 0) {
    if (day) {
      s.zeroHealthMs += seg;
      if (s.zeroHealthMs >= DEATH_AFTER_ZERO_HEALTH_MS) {
        s.deadAt = segTime;
        s.causeOfDeath = causeOfDeath(s);
        s.asleep = false;
        clearCall(s);
      }
    }
  } else if (s.health > 10) {
    s.zeroHealthMs = 0; // meaningfully recovered — reset the doom clock
  }
}

/** What gets carved on the memorial. Illness wins; otherwise infer neglect. */
function causeOfDeath(s: PetState): string {
  if (s.sick && s.illness) return ILLNESSES[s.illness].label;
  if (s.sick) return "a mysterious ailment";
  if (s.energy <= 0) return "an empty bowl";
  if (s.happiness <= 0) return "a broken heart";
  return "general neglect";
}

/** Move to the next life stage. Mutates `s`. Caller guarantees stage≠adult.
 *  `at` is the wall-clock moment the boundary was crossed. */
function advanceOne(s: PetState, at: number): void {
  const cur = s.stage as Exclude<Stage, "adult">;
  const next = STAGE_ORDER[STAGE_ORDER.indexOf(cur) + 1];
  // Carry the awake-time overshoot into the next stage rather than dropping it,
  // so a long catch-up that blew past the boundary keeps its leftover progress.
  s.stageElapsedMs = Math.max(0, s.stageElapsedMs - TIMING[cur]);
  s.stageStartedAt = at;
  s.stage = next;
  if (next === "baby") {
    clearCall(s);
    // Baby is deliberately hectic: it hatches already hungry so care
    // matters immediately and the player learns the controls right away.
    s.energy = Math.min(s.energy, 2);
    s.happiness = Math.min(s.happiness, 2);
  }
  if (next === "adult") s.form = determineAdultForm(s.hidden, s.health);
}

// --- Player actions ---------------------------------------------------------
export interface ActionResult {
  state: PetState;
  /** Optional signal for the UI (e.g. "disliked", "favorite", "toosick"). */
  note?: string;
  /** Set when this action resolved an attention call: a genuine want was met
   *  ("satisfied") or a fake call was rewarded ("spoiled" — a care mistake). */
  call?: "satisfied" | "spoiled";
}

/** A snack/play demand is a genuine need only when the pet has less than one
 *  full heart of that stat left. At a full heart or more it plainly doesn't
 *  need it — it's testing you — so giving in spoils and disciplining is fair. */
const FULL_HEART = 1;

/** Whether an active attention call is unjustified: the pet is faking, or
 *  demanding a resource it plainly doesn't need — a snack while still fed, or
 *  play while still content. A pat is always a fair ask. Evaluate against
 *  pre-action stats, before feeding/playing moves the meter we're judging. */
function callUnjustified(s: PetState): boolean {
  if (!s.wantsAttention) return false;
  if (s.fakeCall) return true;
  switch (s.attentionWant ?? "pat") {
    case "snack":
      return s.energy >= FULL_HEART;
    case "play":
      return s.happiness >= FULL_HEART;
    default:
      return false;
  }
}

/** How much the visible discipline stat moves on a correct scolding — teens
 *  push back harder, so correcting one counts for more. Shared with
 *  `resolveCall`, where falling for the same call costs half as much. */
function disciplineGain(stage: PetState["stage"]): number {
  return stage === "teen" ? 12 : 8;
}

/** Resolve an active attention call whose want this action just met. Mutates
 *  `s` (callers pass a fresh copy) and returns how it landed. `unjustified` is
 *  computed by the caller from pre-action stats (see callUnjustified). */
function resolveCall(
  s: PetState,
  want: AttentionWant,
  unjustified: boolean,
): "satisfied" | "spoiled" | undefined {
  if (!s.wantsAttention || (s.attentionWant ?? "pat") !== want) return undefined;
  clearCall(s);
  if (unjustified) {
    // You placated a demand it didn't need — the lazy calm. It's thrilled;
    // the ledger is not. Disciplining would have been the other option, and
    // missing it costs half the discipline a correct scolding would have won.
    s.hidden = { ...s.hidden, careMistakes: s.hidden.careMistakes + 1 };
    s.happiness = clampHearts(s.happiness + 0.3);
    s.discipline = clamp100(s.discipline - disciplineGain(s.stage) / 2);
    return "spoiled";
  }
  s.happiness = clampHearts(s.happiness + 0.4);
  return "satisfied";
}

/** Shared gate: an egg, a sleeper, the departed, or the dead can't act. */
function cannotAct(s: PetState): boolean {
  return s.stage === "egg" || s.asleep || s.deadAt !== null || s.departedAt !== null;
}

export function feed(state: PetState, food: FoodId, now: number): ActionResult {
  let s = applyElapsedDecay(state, now);
  if (cannotAct(s)) {
    return { state: s, note: "cant" };
  }
  s = { ...s, hidden: { ...s.hidden } };
  // Judge the call before the food lands, or we'd be judging post-feed energy.
  const unjustified = callUnjustified(s);
  const def = FOODS[food];

  // Refuse proper meals when already full (classic Tamagotchi behaviour);
  // treats (cake/cube — anything with real happiness value) are always taken.
  const isTreat = def.happiness >= 0.5;
  if (!isTreat && s.energy >= MAX_HEARTS - 0.05) {
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

  // Dysentery: it runs right through — meals only half stick.
  const efficiency = s.sick && s.illness ? ILLNESSES[s.illness].foodEfficiency : 1;
  s.energy = clampHearts(s.energy + def.energy * efficiency);
  s.happiness = clampHearts(s.happiness + def.happiness + happyBonus);
  s.weight = s.weight + def.weight;
  // Fiber shifts the rolling diet-quality average — recent meals matter more,
  // but one carrot doesn't erase a week of cake. This governs how good the
  // next poop is, not whether/when it happens (see STAGE_POOP_PER_HOUR).
  s.fiberLevel = s.fiberLevel + (def.fiber - s.fiberLevel) * FIBER_EMA_ALPHA;

  s.hidden.mealsEaten++;
  if (food === "cake") {
    s.hidden.cakeEaten++;
    // Junk food nudges health down and raises sickness pressure.
    s.health = clamp100(s.health - 3);
  }
  if (food === "cube") {
    s.hidden.cubeEaten++;
    if (!note) note = "cube";
  }
  if (food === "carrot") {
    s.hidden.carrotEaten++;
    s.health = clamp100(s.health + 4);
  }
  if (food === "soup") {
    // The comfort food: it actively heals, doubly so on a sickbed.
    s.health = clamp100(s.health + (s.sick ? 6 : 2));
    if (!note && s.sick) note = "soup";
  }

  const call = resolveCall(s, "snack", unjustified);
  return { state: s, note, call };
}

/** Apply the happiness reward from a finished mini-game. `reach` is how far an
 *  endless game got (rounds cleared) — only The Cube's Hum uses it, to scale the
 *  reward with distance; other games ignore it. */
export function applyGameResult(
  state: PetState,
  game: GameId,
  won: boolean,
  now: number,
  reach = 0,
): ActionResult {
  let s = applyElapsedDecay(state, now);
  // A sleeping (or unhatched, or dead) pet cannot play — same gate as feed().
  // Without this a game finished after the pet dozed off would still bank its
  // happiness reward. The UI blocks starting a game while asleep; this is the
  // authoritative backstop for a game that outlasts nightfall.
  if (cannotAct(s)) {
    return { state: s, note: "cant" };
  }
  // Same story for an illness that blocks play (the UI checks tooSickToPlay
  // before offering games; this backstops an illness that struck mid-game).
  if (tooSickToPlay(s)) {
    return { state: s, note: "toosick" };
  }
  s = { ...s, hidden: { ...s.hidden, gamePlays: { ...s.hidden.gamePlays } } };
  // Judge the call before the game lifts happiness, or every play reads justified.
  const unjustified = callUnjustified(s);
  s.hidden.gamePlays[game]++;
  let gain = game === "cubehum" ? cubeHumCredit(reach) : won ? 1.5 : 0.4;
  // Carrying extra weight takes some of the joy out of running around.
  if (s.weight >= OVERWEIGHT) gain *= 0.7;
  s.happiness = clampHearts(s.happiness + gain);
  const exertion = GAME_EXERTION[game] ?? BASE_GAME_EXERTION;
  s.energy = clampHearts(s.energy - exertion.energy);
  s.weight = Math.max(1, s.weight - exertion.weight);
  const call = resolveCall(s, "play", unjustified);
  return { state: s, call };
}

export function clean(state: PetState, now: number): ActionResult {
  const s = applyElapsedDecay(state, now);
  if (s.poops === 0) return { state: s, note: "nothing" };
  const next = { ...s, poops: 0, hasBadPoop: false };
  // Tidying up in the dark counts toward the Ghost path, like other night care.
  if (isNight(now) && !next.lightsOn) {
    next.hidden = { ...next.hidden, nightCare: next.hidden.nightCare + 1 };
  }
  return { state: next, note: "cleaned" };
}

export function giveMedicine(state: PetState, now: number): ActionResult {
  let s = applyElapsedDecay(state, now);
  if (!s.sick) {
    // Medicine when not needed is a small care mistake.
    s = { ...s, hidden: { ...s.hidden, careMistakes: s.hidden.careMistakes + 1 } };
    return { state: s, note: "notneeded" };
  }
  // The plague takes two shots, and the second only lands after the first has
  // had an hour to work — a genuine return visit.
  const needed = s.illness ? ILLNESSES[s.illness].doses : 1;
  if (s.dosesGiven > 0 && s.lastDoseAt !== null && now - s.lastDoseAt < DOSE_SPACING_MS) {
    return { state: s, note: "toosoon" };
  }
  const given = s.dosesGiven + 1;
  if (given < needed) {
    s = { ...s, dosesGiven: given, lastDoseAt: now, health: clamp100(s.health + 4) };
    if (!s.lightsOn) s.hidden = { ...s.hidden, nightCare: s.hidden.nightCare + 1 };
    return { state: s, note: "dose" };
  }
  s = { ...s };
  cureIllness(s, 12);
  if (!s.lightsOn) s.hidden = { ...s.hidden, nightCare: s.hidden.nightCare + 1 };
  return { state: s, note: "cured" };
}

/**
 * Discipline is correct when the pet is making an unjustified attention call —
 * faking, or demanding food/play it doesn't actually need (see callUnjustified).
 * Incorrect otherwise (which dings happiness/health).
 */
export function discipline(state: PetState, now: number): ActionResult {
  let s = applyElapsedDecay(state, now);
  if (s.stage === "egg" || s.stage === "baby") {
    return { state: s, note: "cant" }; // babies can't be disciplined
  }
  s = { ...s, hidden: { ...s.hidden } };
  const correct = callUnjustified(s);
  if (correct) {
    // Teen discipline carries more weight.
    const gain = disciplineGain(s.stage);
    s.hidden.discipline += gain;
    s.discipline = clamp100(s.discipline + gain);
    clearCall(s);
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
export const TAP_WINDOW_MS = 12_000;
/** Pokes within the window before the pet gets pissy. */
export const TAP_ANNOY_THRESHOLD = 4;

/**
 * How a poke lands:
 *  - "react": the first poke in a while — a friendly line.
 *  - "ignore": acknowledged with body language only, no line.
 *  - "annoyed": every Nth poke of an unbroken streak — it has had quite
 *    enough of your finger. The streak then keeps ignoring, not reacting,
 *    until the next "annoyed" — it never goes back to "react" mid-streak.
 *  - "answered": a genuine pat-call, satisfied. The cute payoff.
 *  - "hint": a call wants something a poke isn't (see `want`).
 *  - "spoiled": you comforted a fake tantrum. It's delighted. That's the trap.
 *  - "peek": asleep, first poke in a while — one eye cracks open, no line.
 *  - "shush": asleep, poked again mid-streak — it wants you to knock it off.
 */
export type TapReaction =
  | "react"
  | "ignore"
  | "annoyed"
  | "answered"
  | "hint"
  | "spoiled"
  | "peek"
  | "shush";

export interface TapResult {
  state: PetState;
  reaction: TapReaction;
  /** The active call's want, when reaction is "hint". */
  want: AttentionWant | null;
}

export function tap(state: PetState, now: number): TapResult {
  const s = applyElapsedDecay(state, now);
  // The vapors: fainted dead away. A poke gets nothing, not even offense.
  if (s.sick && s.illness === "vapors") {
    return { state: s, reaction: "ignore", want: null };
  }
  // Asleep: no calls, no annoyance ledger — just a cracked eye, then a shush
  // if you keep at it. Reuses the same streak/window fields as the awake game.
  if (s.asleep) {
    const wasQuiet = s.recentTaps.every((t) => now - t >= TAP_WINDOW_MS);
    const recentTaps = [...s.recentTaps, now].filter((t) => now - t < TAP_WINDOW_MS);
    const streakBase = wasQuiet ? 0 : s.tapStreak;
    const next: PetState = { ...s, recentTaps, tapStreak: streakBase + 1 };
    return { state: next, reaction: streakBase === 0 ? "peek" : "shush", want: null };
  }
  // Quiet means every previous poke has aged out of the window — that's what
  // earns a fresh "react" instead of continuing the ignore/annoyed streak.
  const wasQuiet = s.recentTaps.every((t) => now - t >= TAP_WINDOW_MS);
  const recentTaps = [...s.recentTaps, now].filter((t) => now - t < TAP_WINDOW_MS);
  // A genuine quiet gap resets the streak even if it happened while an
  // attention call was open — exploratory hint-pokes for a call shouldn't
  // keep a stale pre-call streak alive once the call resolves.
  const streakBase = wasQuiet ? 0 : s.tapStreak;
  const next: PetState = { ...s, recentTaps, tapStreak: streakBase };

  // An active call takes priority over poke etiquette — it asked for you. But a
  // poke is the wrong gesture for EVERY call now, pat included: a pat-call wants
  // a pat (see pat()), not a finger-jab. So just hint at what it actually wants.
  if (next.wantsAttention) {
    const want = next.attentionWant ?? "pat";
    return { state: next, reaction: "hint", want };
  }

  if (wasQuiet) {
    next.tapStreak = 1;
    return { state: next, reaction: "react", want: null };
  }

  next.tapStreak = streakBase + 1;
  if (next.tapStreak % TAP_ANNOY_THRESHOLD === 0) {
    next.happiness = clampHearts(next.happiness - 0.2);
    return { state: next, reaction: "annoyed", want: null };
  }
  return { state: next, reaction: "ignore", want: null };
}

// --- Pat interaction (the gentle counterpart to a poke) ---------------------
export const PAT_WINDOW_MS = 12_000;
/** Pats allowed within the window before further pats stop paying happiness.
 *  Gentle by design — a pat is never punished, it just stops landing. */
export const PAT_SATIATION = 5;

/**
 * How much a pat delights each adult form, in character with ADULT_FOOD. A dog
 * lives for pats; a gremlin barely tolerates them; a ghost is a bit aloof; the
 * hum-cube is serenely indifferent. Non-adult stages use 1 (see patAffinity).
 */
export const PAT_AFFINITY: Record<AdultForm, number> = {
  dog: 1.6, // the user's ask: "dog thing should probably love pats"
  blob: 1.2,
  carrot: 1.1,
  menace: 1.0,
  office: 1.0,
  scholar: 0.9,
  humcube: 1.0, // a cube is indifferent to affection
  ghost: 0.7, // aloof
  gremlin: 0.6, // low — barely tolerates a hand
  cosmos: 0.9, // distant, but a warm hand still surprises it pleasantly
};

/** Pat multiplier for a pet's current form; 1 before it has one. Exported so
 *  dialogue can flavour the reaction ("she leans right in"). */
export function patAffinity(form: AdultForm | null): number {
  return form ? PAT_AFFINITY[form] : 1;
}

/** How a pat lands. Unlike a poke, a pat is always welcome — the worst case is
 *  "enough", where it simply stops paying out (never a happiness penalty). */
export type PatReaction = "enjoyed" | "answered" | "spoiled" | "enough" | "cant";

export interface PatResult {
  state: PetState;
  reaction: PatReaction;
}

const PAT_HAPPINESS = 0.3;

export function pat(state: PetState, now: number): PatResult {
  const base = applyElapsedDecay(state, now);
  // Same gate as feed(): an egg, a sleeper, or the departed can't be patted.
  // The vapors count too — it's fainted dead away and doesn't feel the hand.
  if (cannotAct(base) || (base.sick && base.illness === "vapors")) {
    return { state: base, reaction: "cant" };
  }
  const s: PetState = { ...base, hidden: { ...base.hidden } };
  s.recentPats = [...s.recentPats, now].filter((t) => now - t < PAT_WINDOW_MS);

  // An active pat-call is answered by the right gesture. Reuse the call
  // machinery: a genuine call → "answered", a fake tantrum comforted → "spoiled".
  if (s.wantsAttention && (s.attentionWant ?? "pat") === "pat") {
    const call = resolveCall(s, "pat", callUnjustified(s));
    return { state: s, reaction: call === "spoiled" ? "spoiled" : "answered" };
  }

  // Rate limit: past the satiation count the pet has had its fill for now, so a
  // pat lands but pays nothing. No happiness is ever subtracted.
  if (s.recentPats.length > PAT_SATIATION) {
    return { state: s, reaction: "enough" };
  }

  // Trimethylaminuria: it enjoys the pat, it just doesn't help. (It smells.)
  const mute = s.sick && s.illness ? ILLNESSES[s.illness].patMute : false;
  if (!mute) {
    s.happiness = clampHearts(s.happiness + PAT_HAPPINESS * patAffinity(s.form));
  }
  return { state: s, reaction: "enjoyed" };
}

// --- Stochastic events (game-loop level, rng injectable) --------------------
export interface EventResult {
  state: PetState;
  events: string[]; // e.g. ["poop", "sick", "call"]
}

/** Simulate stochastic events in slices this long, so an 8-hour absence rolls
 *  the dice ~32 times and produces a plausible scene (several messes, maybe an
 *  illness) instead of a single scaled mega-roll. */
const EVENT_CHUNK_MS = 15 * 60_000;

/**
 * Advance random world events over `elapsed` ms (ending at state.lastUpdated —
 * callers run applyElapsedDecay first). Time is replayed in EVENT_CHUNK_MS
 * slices; slices where the pet is asleep are skipped (quiet time is about
 * being asleep, not the hour — an awake pet with the lights on still gets
 * messes, calls, and the odd bug at 2am). rng defaults to Math.random.
 */
export function stepEvents(
  state: PetState,
  elapsed: number,
  rng: () => number = Math.random,
): EventResult {
  const events: string[] = [];
  if (
    state.stage === "egg" ||
    state.asleep ||
    state.deadAt !== null ||
    state.departedAt !== null
  ) {
    return { state, events };
  }
  const s: PetState = { ...state, hidden: { ...state.hidden } };
  const start = s.lastUpdated - elapsed;
  let offset = 0;

  while (offset < elapsed) {
    const chunk = Math.min(EVENT_CHUNK_MS, elapsed - offset);
    const chunkStart = start + offset;
    offset += chunk;
    // Egg is already excluded above, so this mirrors applyElapsedDecay's own
    // asleep test exactly: night and lights off.
    if (isNight(chunkStart) && !s.lightsOn) continue;
    const perHour = chunk / HOUR;

    // Pooping happens on a regular per-stage schedule, at most one mess per
    // slice. Fiber doesn't gate this anymore — it only decides quality below.
    if (s.poops < MAX_POOPS) {
      let poopPerHour = STAGE_POOP_PER_HOUR[s.stage];
      const dysentery = s.sick && s.illness === "dysentery";
      if (dysentery) poopPerHour += DYSENTERY_POOP_BONUS_PER_HOUR;
      if (rng() < poopPerHour * perHour) {
        s.poops++;
        events.push("poop");
        // Quality comes from recent diet — dysentery always fouls it, fiber
        // decides the rest. Neutral does nothing special; good and bad each
        // cost weight (a bad gut works harder), bad costs a lot more health
        // and leaves a lingering sickness risk until the floor is swept.
        if (dysentery || s.fiberLevel <= FIBER_BAD_THRESHOLD) {
          s.weight = Math.max(1, s.weight - BAD_POOP_WEIGHT_LOSS);
          s.health = clamp100(s.health - BAD_POOP_HEALTH_LOSS);
          s.hasBadPoop = true;
          events.push("poop-bad");
        } else if (s.fiberLevel >= FIBER_GOOD_THRESHOLD) {
          s.weight = Math.max(1, s.weight - GOOD_POOP_WEIGHT_LOSS);
          s.health = clamp100(s.health + GOOD_POOP_HEALTH_GAIN);
        }
      }
    }

    // Falling ill — pressure from low health, lingering mess, and extra weight.
    if (!s.sick) {
      let sickPerHour = 0.01;
      if (s.health < 40) sickPerHour += 0.04;
      if (s.poops >= 2) sickPerHour += 0.02;
      if (s.hasBadPoop) sickPerHour += BAD_POOP_SICK_BONUS;
      if (s.weight >= OVERWEIGHT) sickPerHour += 0.015;
      if (rng() < sickPerHour * perHour) {
        s.sick = true;
        s.illness = rollIllness(rng);
        s.dosesGiven = 0;
        s.lastDoseAt = null;
        s.illnessMs = 0;
        events.push("sick");
      }
    }

    // Attention calls. From teen on, some are fake (boundary-testing). Teens
    // call noticeably more — it's the main source of discipline opportunities.
    // Baby calls far more often still (always genuine — see `fake` below), to
    // keep hatch-day actively demanding.
    // A call rolled during a long absence that would already have gone stale is
    // charged directly: a genuine cry with nobody home is a care mistake.
    const callPerHour = s.stage === "baby" ? 24 : s.stage === "teen" ? 0.8 : 0.4;
    if (!s.wantsAttention && rng() < callPerHour * perHour) {
      const startedAt = chunkStart + chunk;
      const fake =
        rng() < (s.stage === "teen" ? 0.6 : s.stage === "adult" ? 0.45 : 0);
      if (s.lastUpdated - startedAt >= CALL_EXPIRE_MS) {
        if (!fake) s.hidden.careMistakes += 1;
      } else {
        s.wantsAttention = true;
        s.fakeCall = fake;
        // A pat is always a fair ask (see callUnjustified) — a fake call
        // can only ever be faking hunger or boredom, never affection.
        const wants: AttentionWant[] = fake ? ["play", "snack"] : ["pat", "play", "snack"];
        s.attentionWant = wants[Math.floor(rng() * wants.length)];
        s.callStartedAt = startedAt;
        events.push(fake ? "fakecall" : "call");
      }
    }

    // Zoomies: a rare, brief burst of energy in an otherwise well pet — never
    // while sick, mid-call, or already off zooming. Skipped outright (no
    // penalty, unlike a stale call) if it would already be over by the time
    // this catch-up reaches `now`, since it's a moment to watch, not a debt.
    if (
      !s.zoomies &&
      !s.sick &&
      !s.wantsAttention &&
      s.happiness >= 3 &&
      s.health > 50 &&
      rng() < ZOOMIES_PER_HOUR * perHour
    ) {
      const startedAt = chunkStart + chunk;
      if (s.lastUpdated - startedAt < ZOOMIES_DURATION_MS) {
        s.zoomies = true;
        s.zoomiesStartedAt = startedAt;
        events.push("zoomies");
      }
    }
  }

  return { state: s, events };
}

/**
 * Weighted illness pick — the everyday sniffles are common; dysentery, the
 * plague, and the truly exotic trimethylaminuria are rare. Plague stays last so
 * the far tail of the roll still lands on it (see state.test).
 */
export function rollIllness(rng: () => number = Math.random): IllnessId {
  const table: [IllnessId, number][] = [
    ["sniffles", 0.4],
    ["dysentery", 0.2],
    ["goblinflu", 0.15],
    ["vapors", 0.12],
    ["trimethylaminuria", 0.04],
    ["plague", 0.09],
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
  office: { favorite: "salad", disliked: "cube" },
  menace: { favorite: "cake", disliked: "burger" },
  ghost: { favorite: "cube", disliked: "burger" },
  humcube: { favorite: "cube", disliked: null },
  carrot: { favorite: "carrot", disliked: "burger" },
  cosmos: { favorite: "soup", disliked: null },
};
