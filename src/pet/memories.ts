// What the sprite remembers. Mines the same diagnostic trail the History
// screen reads (pet.diag + hidden counters) for moments worth bringing up
// unprompted — the plague it survived, the night it almost wasn't, the four
// hundred games of fetch. Adults only: a memory needs a life behind it, and
// the adult idle beat is where a "remember when" lands as earned rather than
// as a recap. Pure and rng-injectable, like the rest of the dialogue layer.

import { TIMELINE_SPEED } from "./state";
import { ILLNESSES } from "./types";
import type { IllnessId, PetState } from "./types";
import { GAME_NAMES } from "./games";
import { FOODS } from "./roster";
import { mostPlayed } from "./evolution";

const HOUR = 3_600_000;

/** A thing must sit for a while before it's a memory instead of a recap.
 *  Scaled down on the demo timeline so demo pets reminisce too. */
export const MEMORY_MIN_AGE_MS = 18 * HOUR;

/** Base odds a given idle beat turns reminiscent, before the form scaler. */
export const MEMORY_BASE_CHANCE = 0.09;

/** Who dwells on the past. The ghost lives there; the scholar keeps records;
 *  the dog is having too good a time right now to look backward. */
const FORM_MEMORY_AFFINITY: Record<NonNullable<PetState["form"]>, number> = {
  dog: 0.6,
  blob: 1.2,
  gremlin: 0.9,
  scholar: 1.5,
  office: 0.8,
  menace: 0.9,
  ghost: 1.7,
  humcube: 1.2,
  carrot: 1.0,
  cosmos: 1.5,
  mole: 1.1,
};

export type MemoryKind =
  | "illness" // a survived illness, brought up long after
  | "scare" // the zero-health night it doesn't quite name
  | "games" // the lifetime play tally
  | "favorite_game" // the one game clearly played most
  | "cube_record" // best run at The Cube's Hum
  | "diet" // the food it's been fed most
  | "childhood" // echoes of its own baby/child lines
  | "sweeps" // everything you've cleaned up
  | "night_care" // care taken while the lights were off
  | "zoomies" // past bursts, fondly recalled
  | "caught"; // times discipline landed fairly

export interface MemoryCandidate {
  kind: MemoryKind;
  lines: string[];
}

// --- Line banks ---------------------------------------------------------------
// House voice: dry, cute, occasionally sincere. The sincere ones are the point
// here — a memory is the one place the mask is allowed to slip a little.

const ILLNESS_LINES = [
  (ill: string) => `I had ${ill} once. I survived. The illness did not.`,
  (ill: string) => `Remember my ${ill}? Historic stuff. I was so brave and so loud.`,
  (ill: string) => `${cap(ill)} tried to take me once. I'm still here. It isn't. We won.`,
];
const SOUP_CURE_LINES = [
  (ill: string) => `You once cured my ${ill} with soup. Medicine hates that trick.`,
  (ill: string) => `My ${ill} lost a fight with a bowl of soup. I was there. Glorious.`,
];
const NAP_CURE_LINES = [
  () => "The vapors. One nap. Gone. I still nap defensively.",
  () => "A lie-down once cured me of actual vapors. Sleep is my doctor now.",
];
const PLAGUE_LINES = [
  () => "I survived the plague. Both doses. Put it on my statue.",
  () => "The plague and I went two rounds. Check the record. I'm in it. It's not.",
];

const SCARE_LINES = [
  "There was a night I almost left early. You didn't let me. Anyway. Nice grass.",
  "I nearly wasn't, once. You were there. That's the whole story. It's a good one.",
  "We don't name that one bad night. But I remember who showed up. It was you.",
];

const GAMES_LINES = [
  (n: number) => `We've played ${n} games together. I remember winning all of them. Don't check.`,
  (n: number) => `${n} games, you and me. The scorekeeping is emotional, not numerical.`,
];
const FAVORITE_GAME_LINES = [
  (g: string, n: number) => `${g}. ${n} rounds and counting. It's our thing. I've decided.`,
  (g: string, n: number) => `${n} rounds of ${g} so far. Historians will call this an era.`,
];
const CUBE_RECORD_LINES = [
  (n: number) => `Round ${n}. Our best run at the hum. The cube remembers. The cube forgets nothing.`,
  (n: number) => `We once reached round ${n} together. The hum still talks about it.`,
];

const DIET_LINES = [
  (f: string, n: number) => `You've fed me ${f} ${n} times. I notice. I archive.`,
  (f: string, n: number) => `${n} servings of ${f} to date. I keep a list. It's a good list.`,
];

const CHILDHOOD_LINES = [
  "I was an egg once. Cramped. Great acoustics.",
  "I used to be tiny. The floor and I were friends. We still nod.",
  "Somewhere out there is a rock I taught to sit. Still sitting, I hope.",
  "I had a nemesis as a kid. A specific bee. We've made peace.",
  "I invented a number between four and five once. Still proud.",
  "My teen phase happened. We agreed never to discuss it.",
  "I dug a hole as a kid and told you it was invisible. It was just very small.",
];

const SWEEPS_LINES = [
  (n: number) => `You've swept up after me ${n} times. Sainthood has lower requirements.`,
  (n: number) => `${n} messes, ${n} cleanups. The floor and I both owe you.`,
];

const NIGHT_CARE_LINES = [
  "You checked on me in the dark. I was awake. I never said. Thank you.",
  "Some nights you were there when the lights were off. I keep those.",
];

const ZOOMIES_LINES = [
  "Remember the zoomies? The grass remembers. The grass lost.",
  "I used to just... go. In circles. At speed. Peak athletics. No regrets.",
];

const CAUGHT_LINES = [
  (n: number) => `You've caught me ${n} times now. Annoyingly fair, every one.`,
  (n: number) => `${n} fair cops on my record. I respect it. I resent it. Both.`,
];

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// --- Mining the trail ---------------------------------------------------------

/** Every memory the pet could plausibly bring up right now. Exported for tests
 *  and for Dev Tools curiosity; gameplay goes through memoryLine(). */
export function eligibleMemories(pet: PetState, now: number): MemoryCandidate[] {
  if (pet.stage !== "adult") return [];
  const minAge = MEMORY_MIN_AGE_MS / TIMELINE_SPEED[pet.timeline];
  const old = (t: number): boolean => now - t >= minAge;
  const out: MemoryCandidate[] = [];

  // Survived illnesses: every distinct cured illness, once it's had time to
  // become an anecdote — and never the one it's currently down with.
  const cured = new Map<IllnessId, string>(); // illness → via
  let scareAt: number | null = null;
  let zoomiesCount = 0;
  let sweptTotal = 0;
  let caughtCount = 0;
  for (const e of pet.diag) {
    if (e.kind === "cured" && e.note && old(e.t)) {
      const m = /^(\w+) \((.+)\)$/.exec(e.note);
      if (m && m[1] in ILLNESSES && m[1] !== pet.illness) {
        cured.set(m[1] as IllnessId, m[2]);
      }
    } else if (e.kind === "recovered" && old(e.t)) {
      scareAt = e.t;
    } else if (e.kind === "zoomies" && old(e.t)) {
      zoomiesCount++;
    } else if (e.kind === "cleaned" && e.note) {
      const n = parseInt(e.note, 10);
      if (!Number.isNaN(n)) sweptTotal += n;
    } else if (e.kind === "discipline" && e.note === "correct") {
      caughtCount++;
    }
  }
  for (const [ill, via] of cured) {
    const label = ILLNESSES[ill].label;
    let lines: string[];
    if (ill === "plague") lines = PLAGUE_LINES.map((f) => f());
    else if (via === "nap") lines = NAP_CURE_LINES.map((f) => f());
    else if (via === "soup") lines = SOUP_CURE_LINES.map((f) => f(label));
    else lines = ILLNESS_LINES.map((f) => f(label));
    out.push({ kind: "illness", lines });
  }

  if (scareAt !== null && pet.zeroHealthMs === 0) {
    out.push({ kind: "scare", lines: SCARE_LINES });
  }

  // Play history, from the hidden counters (no timestamps needed — the
  // thresholds themselves imply a history).
  const plays = pet.hidden.gamePlays;
  const total = (Object.values(plays) as number[]).reduce((a, b) => a + b, 0);
  if (total >= 12) {
    out.push({ kind: "games", lines: GAMES_LINES.map((f) => f(total)) });
  }
  const top = mostPlayed(plays);
  if (top.unique && top.count >= 6) {
    const name = GAME_NAMES[top.game];
    out.push({
      kind: "favorite_game",
      lines: FAVORITE_GAME_LINES.map((f) => f(name, top.count)),
    });
  }

  // Best run at the one endless game, from its "cubehum reach N" notes.
  let bestReach = 0;
  for (const e of pet.diag) {
    if (e.kind === "played" && e.note?.startsWith("cubehum reach ") && old(e.t)) {
      const n = parseInt(e.note.slice("cubehum reach ".length), 10);
      if (!Number.isNaN(n) && n > bestReach) bestReach = n;
    }
  }
  if (bestReach >= 5) {
    out.push({ kind: "cube_record", lines: CUBE_RECORD_LINES.map((f) => f(bestReach)) });
  }

  // The food it's seen the most of. Counted from fed events so every food
  // qualifies, not just the evolution-tracked three.
  const fedCounts = new Map<string, number>();
  for (const e of pet.diag) {
    if (e.kind === "fed" && e.note && e.note in FOODS) {
      fedCounts.set(e.note, (fedCounts.get(e.note) ?? 0) + 1);
    }
  }
  let topFood: string | null = null;
  let topFoodCount = 0;
  for (const [food, n] of fedCounts) {
    if (n > topFoodCount) {
      topFood = food;
      topFoodCount = n;
    }
  }
  if (topFood && topFoodCount >= 8) {
    const name = FOODS[topFood as keyof typeof FOODS].name.toLowerCase();
    out.push({ kind: "diet", lines: DIET_LINES.map((f) => f(name, topFoodCount)) });
  }

  // Its own childhood — every adult has one, and these echo actual lines from
  // the baby/child banks for anyone who was paying attention back then.
  out.push({ kind: "childhood", lines: CHILDHOOD_LINES });

  if (sweptTotal >= 10) {
    out.push({ kind: "sweeps", lines: SWEEPS_LINES.map((f) => f(sweptTotal)) });
  }
  if (pet.hidden.nightCare >= 3) {
    out.push({ kind: "night_care", lines: NIGHT_CARE_LINES });
  }
  if (zoomiesCount >= 2) {
    out.push({ kind: "zoomies", lines: ZOOMIES_LINES });
  }
  if (caughtCount >= 3) {
    out.push({ kind: "caught", lines: CAUGHT_LINES.map((f) => f(caughtCount)) });
  }

  return out;
}

/** Odds this idle beat goes reminiscent. Zero for anything not yet grown. */
export function memoryChance(pet: PetState): number {
  if (pet.stage !== "adult" || !pet.form) return 0;
  return MEMORY_BASE_CHANCE * FORM_MEMORY_AFFINITY[pet.form];
}

/** One memory, told now — or null when there's nothing worth retelling. */
export function memoryLine(
  pet: PetState,
  now: number,
  rng: () => number = Math.random,
): string | null {
  const candidates = eligibleMemories(pet, now);
  if (!candidates.length) return null;
  const c = candidates[Math.floor(rng() * candidates.length)];
  return c.lines[Math.floor(rng() * c.lines.length)];
}
