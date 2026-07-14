// Shared domain types for the pet game. Pure data — no DOM, no logic.

export const MAX_HEARTS = 4;

export type Stage = "egg" | "baby" | "child" | "teen" | "adult";

/** The six standard adult forms, three earnable secrets (ghost, humcube,
 *  carrot), one ultra-rare secret (cosmos) that no upbringing can summon —
 *  it's pure luck — and the mole, which isn't raised at all: it's an easter
 *  egg keyed to the pet's name, and never appears in the collection. */
export type AdultForm =
  | "dog"
  | "blob"
  | "gremlin"
  | "scholar"
  | "office"
  | "menace"
  | "ghost"
  | "humcube"
  | "carrot"
  | "cosmos"
  | "mole";

export type FoodId = "burger" | "cake" | "carrot" | "salad" | "cube" | "soup";

/** What the sky looks like right now. Dusk and dawn are the hour either side of
 *  night and are purely cosmetic: to every rule in the game, dusk is day and
 *  dawn is night (see skyPhase / isNight in state.ts). */
export type SkyPhase = "day" | "dusk" | "night" | "dawn";

/** Which clock the pet lives on. "real" is the wall-clock game (stages take
 *  days); "demo" runs game-time at TIMELINE_SPEED (state.ts) so a whole life
 *  plays out in a sitting. A dev/demo lever, switched from the Dev Tools
 *  panel — night/day stays on the wall clock either way. */
export type Timeline = "real" | "demo";

/** What an attention call is actually about. Fake calls pick one too — the con
 *  only works if it sounds exactly like a real request. */
export type AttentionWant = "pat" | "play" | "snack";

export type GameId =
  | "higherlower"
  | "fetch"
  | "rps"
  | "hideseek"
  | "wouldyou"
  | "cubehum";

/** Named illnesses in the proud tradition of Oregon Trail. */
export type IllnessId =
  | "sniffles"
  | "dysentery"
  | "goblinflu"
  | "vapors"
  | "trimethylaminuria"
  | "plague";

export interface IllnessDef {
  id: IllnessId;
  /** Rendered as "NAME has {label}." */
  label: string;
  /** Medicine doses required to cure. Only the plague needs two. */
  doses: number;
  /** Health lost per awake daytime hour while this goes untreated. Halved
   *  overnight — evening illness matters but can never kill before morning. */
  drainPerHour: number;
  /** Happiness decays this much faster while sick (misery multiplier). */
  happinessDecayMult: number;
  /** True → too weak for mini-games. Only the sniffles are mild enough to
   *  play through. */
  blocksPlay: boolean;
  /** True → too unwell to eat until cured (medicine still works). Only the
   *  sniffles, the vapors, and goblin flu leave the appetite alone. */
  blocksFeed: boolean;
  /** True → the pet is unresponsive: pats land but pay nothing. */
  patMute: boolean;
  /** Clears on its own after this much daytime, no medicine needed. */
  selfResolveMs: number | null;
  /** True → also curable by a ≥1h daytime lights-off nap (the vapors). */
  napCure: boolean;
  /** True → also curable by a bowl of soup: the folk remedies, the ones a warm
   *  bowl plausibly fixes. The gut-and-glands illnesses (dysentery,
   *  trimethylaminuria) and the plague still want real medicine. */
  soupCure: boolean;
  /** Whether leaving it untreated counts as neglect (care mistakes). The
   *  sniffles are too mild to hold against anyone. */
  neglect: boolean;
}

const HOUR = 3_600_000;

// Severity ladder: the announcement name tells you how urgently to respond.
export const ILLNESSES: Record<IllnessId, IllnessDef> = {
  sniffles: {
    id: "sniffles", label: "the sniffles", doses: 1,
    drainPerHour: 0, happinessDecayMult: 1.5, blocksPlay: false, blocksFeed: false,
    patMute: false,
    selfResolveMs: 4 * HOUR, napCure: false, soupCure: true,
    neglect: false,
  },
  dysentery: {
    id: "dysentery", label: "dysentery", doses: 1,
    drainPerHour: 8, happinessDecayMult: 1, blocksPlay: true, blocksFeed: true,
    patMute: false,
    selfResolveMs: null, napCure: false, soupCure: false,
    neglect: true,
  },
  goblinflu: {
    id: "goblinflu", label: "goblin flu", doses: 1,
    drainPerHour: 10, happinessDecayMult: 1.25, blocksPlay: true, blocksFeed: false,
    patMute: false,
    selfResolveMs: null, napCure: false, soupCure: true,
    neglect: true,
  },
  vapors: {
    id: "vapors", label: "the vapors", doses: 1,
    drainPerHour: 6, happinessDecayMult: 1, blocksPlay: true, blocksFeed: false,
    patMute: true,
    selfResolveMs: null, napCure: true, soupCure: true,
    neglect: true,
  },
  trimethylaminuria: {
    id: "trimethylaminuria", label: "trimethylaminuria", doses: 1,
    drainPerHour: 0, happinessDecayMult: 1.5, blocksPlay: true, blocksFeed: true,
    patMute: true,
    selfResolveMs: null, napCure: false, soupCure: false,
    neglect: true,
  },
  plague: {
    id: "plague", label: "the plague", doses: 2,
    drainPerHour: 14, happinessDecayMult: 1.25, blocksPlay: true, blocksFeed: true,
    patMute: false,
    selfResolveMs: null, napCure: false, soupCure: false,
    neglect: true,
  },
};

/** Hidden stats the player never sees directly. */
export interface HiddenStats {
  careMistakes: number; // missed needs, wrong scolding, ignored illness
  cakeEaten: number;
  cubeEaten: number;
  carrotEaten: number;
  mealsEaten: number; // every feed of any kind — the denominator for purity

  discipline: number; // hidden discipline score (0..100-ish)
  nightCare: number; // care actions taken while lights are off (Ghost path)
  gamePlays: Record<GameId, number>;
}

export interface PetState {
  name: string;
  createdAt: number; // ms epoch, hatch/birth reference
  lastUpdated: number;
  /** Which clock this pet lives on — see Timeline. */
  timeline: Timeline;

  stage: Stage;
  /** Wall-clock moment the CURRENT stage began. Kept for display/debug and for
   *  the scene's "adults mellow with age" cadence; it no longer drives stage
   *  advancement (that's stageElapsedMs). */
  stageStartedAt: number;
  /** Awake-equivalent progress (ms) through the current stage. Time awake
   *  accrues at 1×, asleep at SLEEP_AGE_RATE — so a sleeping pet barely ages.
   *  Advances to the next stage when this reaches TIMING[stage]. */
  stageElapsedMs: number;
  /** Set once the pet evolves into an adult. */
  form: AdultForm | null;

  // Visible stats (0..MAX_HEARTS for meters; health/discipline 0..100).
  energy: number;
  happiness: number;
  health: number; // 0..100
  discipline: number; // 0..100, visible on Status
  weight: number; // grams-ish flavour number

  asleep: boolean;
  lightsOn: boolean;
  sick: boolean;
  /** Which illness, when sick. Old saves may have sick=true with no illness. */
  illness: IllnessId | null;
  /** Medicine doses already given toward the current illness. */
  dosesGiven: number;
  /** When the last dose landed — the plague's second shot needs ≥1h spacing. */
  lastDoseAt: number | null;
  /** Daytime elapsed with the current illness (drives sniffles self-resolve). */
  illnessMs: number;
  /** Continuous daytime lights-off span — a ≥1h nap cures the vapors. */
  napMs: number;
  poops: number; // count of uncleaned messes on the floor
  /** Rolling average of recent meals' fiber content (see feed()). Doesn't
   *  drive whether a poop happens — that's a regular per-stage schedule now
   *  — only how good it is when it does (see stepEvents). */
  fiberLevel: number;
  /** True while at least one of the current uncleaned poops was bad quality.
   *  Raises sickness risk until the floor is swept (see clean()). */
  hasBadPoop: boolean;
  /** True from the moment dysentery is caught until its first accident lands.
   *  A real gut bug doesn't wait for a probability roll — see stepEvents(). */
  dysenteryPoopOwed: boolean;

  /** Daytime spent with an empty stomach. Penalties (health drain, care
   *  mistakes) only start past a grace window — a briefly-empty bowl is not
   *  neglect, an hour-empty one is. Resets the moment energy rises. */
  energyZeroMs: number;
  /** Same accumulator for happiness at zero (shorter grace, no health drain). */
  happinessZeroMs: number;

  /** Time awake / asleep since dusk. Evaluated at dawn: a full night awake is
   *  a care mistake; a full night's sleep (fed, clean, well) is a health bonus.
   *  Both reset at dawn. */
  nightAwakeMs: number;
  nightSleepMs: number;

  /** Sustained daytime (ms) spent at zero health — the road to death. The doom
   *  clock pauses overnight: nothing dies while its keeper sleeps. */
  zeroHealthMs: number;
  /** Set when the pet dies. The game shows a memorial and starts over. */
  deadAt: number | null;
  causeOfDeath: string | null;

  /** Awake-daytime accrued as an adult, scaled by care quality (thriving pets
   *  age toward retirement slower). Drives the restless → ready → departed
   *  retirement arc. */
  adultLifeMs: number;
  /** Set when a ready adult finally walks itself to the farm at dawn. */
  departedAt: number | null;

  /** True when the pet is making a genuine or fake attention call. */
  wantsAttention: boolean;
  /** When true the current attention call is fake (disciplining it is correct). */
  fakeCall: boolean;
  /** What the current call is asking for. Null when no call is active. */
  attentionWant: AttentionWant | null;
  /** When the current call started. Unanswered calls expire after a while —
   *  a genuine one that times out is a care mistake. */
  callStartedAt: number | null;

  /** A rare, brief burst of pure energy — the pet zooms around the screen. */
  zoomies: boolean;
  /** When the current zoomies burst started. Self-expires; no penalty. */
  zoomiesStartedAt: number | null;

  hidden: HiddenStats;

  /** Debug trail: hourly vitals and notable transitions, both bounded rings.
   *  See the Diagnostics block below. Never shown to the player. */
  vitals: VitalsSample[];
  diag: DiagEvent[];
  /** Lifetime count of samples/events ever logged — keeps counting past the
   *  ring's cap, so once a ring has evicted its oldest entries this is bigger
   *  than vitals.length/diag.length. Lets the debug report say exactly how
   *  many were dropped instead of leaving it silent. */
  vitalsTotal: number;
  diagTotal: number;

  recentTaps: number[];
  /** Timestamps of recent pats, for the pat satiation window (mirrors
   *  recentTaps). A pat is never punished; past a threshold it just stops
   *  paying happiness. */
  recentPats: number[];
  /** Consecutive pokes in the current unbroken tapping streak — drives the
   *  repeating ignore/annoyed cadence independent of how many age out of
   *  `recentTaps`'s trailing window. Resets only once the streak goes quiet. */
  tapStreak: number;
  lastIdleLineAt: number;
}

// --- Diagnostics --------------------------------------------------------------
// A pet's final hours are the ones nobody is awake to watch, so the state alone
// can't answer "how did it get like this". These two bounded rings record the
// trail: hourly vitals, plus the notable transitions between them. They ride
// along in PetState (so they persist across reloads) and are copied into the
// FarmEntry on burial, so a death stays reconstructable after the pet is gone.

/** One hourly snapshot. Floats are rounded — this is for reading, not maths. */
export interface VitalsSample {
  t: number;
  health: number;
  energy: number;
  happiness: number;
  weight: number;
  poops: number;
  illness: IllnessId | null;
  asleep: boolean;
  lightsOn: boolean;
  /** The death clock. Anything nonzero here is the signal that matters most. */
  zeroHealthMs: number;
  careMistakes: number;
}

export type DiagKind =
  | "hatched"
  | "stage"
  | "sick"
  | "cured"
  | "poop"
  | "fed"
  | "cleaned"
  | "medicine"
  | "played"
  | "pat"
  | "tap"
  | "discipline"
  | "call"
  | "zoomies"
  | "lights"
  | "retirement"
  | "dawn"
  | "zero-health"
  | "recovered"
  | "death"
  | "timeline"
  | "dev";

/** A notable transition, logged as it happens. `note` carries the detail —
 *  the illness name, the food, the cause of death. */
export interface DiagEvent {
  t: number;
  kind: DiagKind;
  note?: string;
}

export interface FarmEntry {
  name: string;
  form: AdultForm | null;
  finalStage: Stage;
  ageMs: number;
  hatchedAt: number;
  retiredAt: number;
  /** True when the sprite died rather than retiring. */
  passedAway?: boolean;
  /** e.g. "dysentery" — memorialised on the farm card. */
  cause?: string | null;
  /** The full final state, kept for debugging. A memorial card never shows
   *  this; it exists so a death can still be explained days later. Optional
   *  because entries written before diagnostics existed won't have it. */
  final?: PetState;
}

export function emptyHidden(): HiddenStats {
  return {
    careMistakes: 0,
    cakeEaten: 0,
    cubeEaten: 0,
    carrotEaten: 0,
    mealsEaten: 0,
    discipline: 0,
    nightCare: 0,
    gamePlays: {
      higherlower: 0,
      fetch: 0,
      rps: 0,
      hideseek: 0,
      wouldyou: 0,
      cubehum: 0,
    },
  };
}
