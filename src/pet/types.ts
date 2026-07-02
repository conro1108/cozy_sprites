// Shared domain types for the pet game. Pure data — no DOM, no logic.

export const MAX_HEARTS = 4;

export type Stage = "egg" | "baby" | "child" | "teen" | "adult";

/** The six adult forms shipped in v1 (see SPEC §12). */
export type AdultForm =
  | "dog"
  | "blob"
  | "gremlin"
  | "scholar"
  | "office"
  | "menace";

export type FoodId = "burger" | "cake" | "carrot" | "noodles" | "cube";

export type GameId = "higherlower" | "fetch" | "rps" | "hideseek" | "wouldyou";

/** Hidden stats the player never sees directly (SPEC §7, §15). */
export interface HiddenStats {
  careMistakes: number; // missed needs, wrong scolding, ignored illness
  cakeEaten: number;
  cubeEaten: number;
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
  poops: number; // count of uncleaned messes on the floor

  /** True when the pet is making a genuine or fake attention call. */
  wantsAttention: boolean;
  /** When true the current attention call is fake (disciplining it is correct). */
  fakeCall: boolean;

  hidden: HiddenStats;

  recentTaps: number[];
  lastIdleLineAt: number;
}

export interface FarmEntry {
  name: string;
  form: AdultForm | null;
  finalStage: Stage;
  ageMs: number;
  hatchedAt: number;
  retiredAt: number;
}

export function emptyHidden(): HiddenStats {
  return {
    careMistakes: 0,
    cakeEaten: 0,
    cubeEaten: 0,
    discipline: 0,
    nightCare: 0,
    gamePlays: {
      higherlower: 0,
      fetch: 0,
      rps: 0,
      hideseek: 0,
      wouldyou: 0,
    },
  };
}
