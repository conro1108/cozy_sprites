// Shared domain types for the pet game. Pure data — no DOM, no logic.

export const MAX_HEARTS = 4;

export type Stage = "egg" | "baby" | "child" | "teen" | "adult";

/** The six standard adult forms plus three secrets (ghost, humcube, carrot). */
export type AdultForm =
  | "dog"
  | "blob"
  | "gremlin"
  | "scholar"
  | "office"
  | "menace"
  | "ghost"
  | "humcube"
  | "carrot";

export type FoodId = "burger" | "cake" | "carrot" | "noodles" | "cube";

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
}

export const ILLNESSES: Record<IllnessId, IllnessDef> = {
  sniffles: { id: "sniffles", label: "the sniffles", doses: 1 },
  dysentery: { id: "dysentery", label: "dysentery", doses: 1 },
  goblinflu: { id: "goblinflu", label: "goblin flu", doses: 1 },
  vapors: { id: "vapors", label: "the vapors", doses: 1 },
  trimethylaminuria: { id: "trimethylaminuria", label: "trimethylaminuria", doses: 1 },
  plague: { id: "plague", label: "the plague", doses: 2 },
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

  stage: Stage;
  stageStartedAt: number;
  /** Set once the pet evolves into an adult. */
  form: AdultForm | null;

  // Visible stats (0..MAX_HEARTS for meters; health/discipline 0..100).
  hunger: number;
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
  poops: number; // count of uncleaned messes on the floor

  /** Sustained time (ms) spent at zero health — the road to death. */
  zeroHealthMs: number;
  /** Set when the pet dies. The game shows a memorial and starts over. */
  deadAt: number | null;
  causeOfDeath: string | null;

  /** True when the pet is making a genuine or fake attention call. */
  wantsAttention: boolean;
  /** When true the current attention call is fake (disciplining it is correct). */
  fakeCall: boolean;
  /** What the current call is asking for. Null when no call is active. */
  attentionWant: AttentionWant | null;

  hidden: HiddenStats;

  recentTaps: number[];
  /** Consecutive pokes in the current unbroken tapping streak — drives the
   *  repeating ignore/annoyed cadence independent of how many age out of
   *  `recentTaps`'s trailing window. Resets only once the streak goes quiet. */
  tapStreak: number;
  lastIdleLineAt: number;
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
