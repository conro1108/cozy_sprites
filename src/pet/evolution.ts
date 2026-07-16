// Hidden evolution scoring. The player never sees these numbers —
// they learn the influences empirically ("too much cake made a blob"). We score
// every candidate adult from the hidden stats and take the highest.

import type { AdultForm, GameId, HiddenStats } from "./types";
import { GAME_NAMES } from "./games";

const r1 = (v: number): number => Math.round(v * 10) / 10;

/**
 * The pet's favourite game — but only if it's *uniquely* most-played. Playing
 * everything equally is not an enthusiasm, and must not silently count as one
 * (it used to resolve to whichever game iterated first, biasing evolution).
 * Exported so Dev Tools can surface which game (if any) currently counts.
 */
export function mostPlayed(
  plays: Record<GameId, number>,
): { game: GameId; count: number; unique: boolean } {
  let best: GameId = "fetch";
  let count = -1;
  let runnerUp = -1;
  (Object.keys(plays) as GameId[]).forEach((g) => {
    if (plays[g] > count) {
      runnerUp = count;
      count = plays[g];
      best = g;
    } else if (plays[g] > runnerUp) {
      runnerUp = plays[g];
    }
  });
  return { game: best, count, unique: count > runnerUp };
}

/** One line item in a form's score: what it is, how much it's adding right now
 *  (0 when its condition isn't met), whether it's currently firing, and a hint
 *  on what drives it / how to move it. Dev Tools renders these verbatim. */
export interface ScoreTerm {
  label: string;
  value: number;
  active: boolean;
  hint?: string;
}

/** A whole form's score, broken into its terms. `notes` carries the things that
 *  aren't score terms at all — the name/luck overrides that bypass scoring. */
export interface FormBreakdown {
  total: number;
  terms: ScoreTerm[];
  notes: string[];
}

/** The full, human-readable derivation of every form's score — the single
 *  source of truth. `scoreForms` is just the totals of this. Every additive
 *  piece of the old scoring is one term here, listed even when it's inactive
 *  (value 0) so the panel can show what *could* contribute and why it isn't.
 */
export function explainForms(
  hidden: HiddenStats,
  health: number,
): Record<AdultForm, FormBreakdown> {
  const { game: topGame, count: topCount, unique } = mostPlayed(hidden.gamePlays);
  const hasTopGame = topCount > 0 && unique;
  const topName = hasTopGame ? GAME_NAMES[topGame] : "no clear favorite";
  const mistakes = hidden.careMistakes;
  const wellCared = mistakes < 3 && health > 60;
  const { cakeEaten, cubeEaten, carrotEaten, mealsEaten, discipline, nightCare } = hidden;

  // How this form's favorite game currently stands, phrased for a hint.
  const topGameHint = (want: GameId) =>
    hasTopGame && topGame === want
      ? undefined
      : `Top game is ${topName}. Make ${GAME_NAMES[want]} your single most-played game.`;

  const fetchTop = hasTopGame && topGame === "fetch";
  const hlTop = hasTopGame && topGame === "higherlower";
  const cubeTop = hasTopGame && topGame === "cubehum";
  const carrotPure = mealsEaten >= 5 && carrotEaten === mealsEaten;
  const balancedCake = Math.max(0, 2 - Math.abs(cakeEaten - 2));

  const b: Record<AdultForm, FormBreakdown> = {
    // Loyal Dog Thing — fetch enthusiast, well cared for. Ordinary wear and
    // tear (a couple of mistakes) shouldn't disqualify a devoted fetcher.
    dog: build([
      {
        label: "Fetch is your top game (+4)",
        value: fetchTop ? 4 : 0,
        active: fetchTop,
        hint: topGameHint("fetch"),
      },
      {
        label: "…and well cared for (+3)",
        value: fetchTop && wellCared ? 3 : 0,
        active: fetchTop && wellCared,
        hint: `Needs the fetch path, <3 care mistakes (now ${r1(mistakes)}) and health >60 (now ${r1(health)}).`,
      },
      {
        label: "Care-mistake penalty (−0.5 each)",
        value: fetchTop ? -mistakes * 0.5 : 0,
        active: fetchTop && mistakes > 0,
        hint: fetchTop
          ? `−0.5 × ${r1(mistakes)} mistakes.`
          : "Only bites once fetch is your top game.",
      },
    ], ['A pet named "Poppy" becomes a dog outright, whatever the score.']),

    // Dramatic Blob — cake habit + a bit of drama/neglect.
    blob: build([
      {
        label: `Cake eaten ×${cakeEaten} (+1.5 each)`,
        value: cakeEaten * 1.5,
        active: cakeEaten > 0,
        hint: "The big one — uncapped, +1.5 per cake.",
      },
      {
        label: "Higher / Lower is your top game (+1)",
        value: hlTop ? 1 : 0,
        active: hlTop,
        hint: topGameHint("higherlower"),
      },
      {
        label: "Mild neglect: 2–5 care mistakes (+2)",
        value: mistakes >= 2 && mistakes < 6 ? 2 : 0,
        active: mistakes >= 2 && mistakes < 6,
        hint: `Now ${r1(mistakes)} mistakes; band is 2 up to (not incl.) 6.`,
      },
    ]),

    // Gremlin — genuine chaos: a real pile of mistakes with no discipline to
    // rein it in. The cube plays no part — its devoted path is the Humming Cube.
    gremlin: build([
      {
        label: `Care mistakes ×${r1(mistakes)} (+0.6 each)`,
        value: mistakes * 0.6,
        active: mistakes > 0,
        hint: "+0.6 per care mistake.",
      },
      {
        label: "Real chaos: ≥4 mistakes AND discipline <10 (+2)",
        value: mistakes >= 4 && discipline < 10 ? 2 : 0,
        active: mistakes >= 4 && discipline < 10,
        hint: `Now ${r1(mistakes)} mistakes, hidden discipline ${r1(discipline)}.`,
      },
    ]),

    // Little Scholar — disciplined, curious, cake-averse.
    scholar: build([
      {
        label: `Hidden discipline ${r1(discipline)} (+0.2 each)`,
        value: discipline * 0.2,
        active: discipline > 0,
        hint: "+0.2 per hidden-discipline point (earned by correct scoldings).",
      },
      {
        label: "Higher / Lower is your top game (+2)",
        value: hlTop ? 2 : 0,
        active: hlTop,
        hint: topGameHint("higherlower"),
      },
      {
        label: `Cake penalty ×${cakeEaten} (−1 each)`,
        value: -cakeEaten,
        active: cakeEaten > 0,
        hint: "Every cake works directly against the scholar.",
      },
    ]),

    // Fancy Little Menace — high discipline + refined (cake) + low mistakes.
    menace: build([
      {
        label: `Hidden discipline ${r1(discipline)} (+0.12 each)`,
        value: discipline * 0.12,
        active: discipline > 0,
        hint: "+0.12 per hidden-discipline point.",
      },
      {
        label: `Cake eaten ×${cakeEaten} (+0.5 each)`,
        value: cakeEaten * 0.5,
        active: cakeEaten > 0,
        hint: "Refined taste — half of what a cake gives the blob.",
      },
      {
        label: "Refined & disciplined: <2 mistakes AND (discipline >20 or cake >2) (+3)",
        value: mistakes < 2 && (discipline > 20 || cakeEaten > 2) ? 3 : 0,
        active: mistakes < 2 && (discipline > 20 || cakeEaten > 2),
        hint: `Now ${r1(mistakes)} mistakes, discipline ${r1(discipline)}, cake ${cakeEaten}.`,
      },
    ]),

    // The unremarkable default: a small baseline plus a nudge for a moderate,
    // balanced cake intake. Wins when nothing else dominates.
    office: build([
      {
        label: "Baseline — the default when nothing dominates (+2)",
        value: 2,
        active: true,
        hint: "Every pet starts here; other forms have to out-earn it.",
      },
      {
        label: "Balanced cake intake, peaks at ~2 cakes",
        value: balancedCake,
        active: balancedCake > 0,
        hint: `2 − |cakes − 2|, floored at 0. Now ${cakeEaten} cakes → +${r1(balancedCake)}.`,
      },
    ]),

    // Ghost (secret) — raised in the dark: care given with the lights off.
    ghost: build([
      {
        label: `Night care ×${nightCare} (+0.9 each)`,
        value: nightCare * 0.9,
        active: nightCare > 0,
        hint: "+0.9 for each care action taken with the lights off.",
      },
      {
        label: "Raised in the dark: ≥8 night care (+3)",
        value: nightCare >= 8 ? 3 : 0,
        active: nightCare >= 8,
        hint: `Now ${nightCare} night-care actions.`,
      },
    ]),

    // The Humming Cube (secret) — cube devotion done calmly: its humming game,
    // reinforced by an actual cube diet. Cube eaten alone is neutral; it only
    // counts once the game proves the devotion is real.
    humcube: build([
      {
        label: "The Cube's Hum is your top game (+4)",
        value: cubeTop ? 4 : 0,
        active: cubeTop,
        hint: topGameHint("cubehum"),
      },
      {
        label: `Cube eaten ×${cubeEaten} on the hum path (+0.5 each)`,
        value: cubeTop ? cubeEaten * 0.5 : 0,
        active: cubeTop && cubeEaten > 0,
        hint: cubeTop
          ? "+0.5 per cube, but only while Cube's Hum leads."
          : "Cube diet counts only once Cube's Hum is your top game.",
      },
      {
        label: "Devout cube diet: ≥3 cubes on the hum path (+3)",
        value: cubeTop && cubeEaten >= 3 ? 3 : 0,
        active: cubeTop && cubeEaten >= 3,
        hint: `Now ${cubeEaten} cubes eaten.`,
      },
    ]),

    // The Blessed Carrot (secret) — absolute dietary purity. A single non-carrot
    // meal breaks the vow: no partial credit.
    carrot: build([
      {
        label: "Pure carrot diet: ≥5 meals, every one a carrot (+12, +0.5/carrot)",
        value: carrotPure ? 12 + carrotEaten * 0.5 : 0,
        active: carrotPure,
        hint: carrotPure
          ? `${carrotEaten} carrots → +${r1(12 + carrotEaten * 0.5)}.`
          : `Now ${carrotEaten}/${mealsEaten} meals were carrots; one non-carrot breaks it.`,
      },
    ]),

    // Never scored — drawn by luck.
    cosmos: {
      total: 0,
      terms: [],
      notes: [
        "Never scored. After scoring, any outcome that isn't a gremlin has a flat 1% chance of becoming the cosmos instead. Pure luck, not upbringing.",
      ],
    },

    // Never scored, never traced in-game.
    mole: {
      total: 0,
      terms: [],
      notes: ['Never scored. Only a pet named "Connor" becomes one — by name alone.'],
    },
  };

  return b;
}

/** Sum a term list into a breakdown. */
function build(terms: ScoreTerm[], notes: string[] = []): FormBreakdown {
  return { total: terms.reduce((sum, t) => sum + t.value, 0), terms, notes };
}

/** The scores alone — totals of `explainForms`, so the two can't drift. */
export function scoreForms(
  hidden: HiddenStats,
  health: number,
): Record<AdultForm, number> {
  const b = explainForms(hidden, health);
  return Object.fromEntries(
    (Object.keys(b) as AdultForm[]).map((f) => [f, b[f].total]),
  ) as Record<AdultForm, number>;
}

/** How close two scores must be to count as "the upbringing didn't decide". */
const TIE_EPSILON = 0.5;

export function determineAdultForm(
  hidden: HiddenStats,
  health: number,
  rng: () => number = Math.random,
  name?: string,
): AdultForm {
  // A pet named Poppy is always the Loyal Dog Thing — no upbringing overrides it.
  if (name?.trim().toLowerCase() === "poppy") return "dog";
  // The Software Mole: an easter egg, not a personality. Naming your pet Connor
  // is the only way to get one, and it is the *whole* way — this returns before
  // scoring and before the cosmos roll below, so no upbringing earns it and no
  // luck takes it away. Nothing in the collection ever hints it exists.
  if (name?.trim().toLowerCase() === "connor") return "mole";

  const scores = scoreForms(hidden, health);
  // Sort descending so rng()=0 deterministically yields the top scorer.
  const ranked = (Object.keys(scores) as AdultForm[]).sort(
    (a, b) => scores[b] - scores[a],
  );
  // Near-ties break randomly — a raising style that didn't clearly commit
  // shouldn't produce the identical adult on every single run.
  const top = scores[ranked[0]];
  const candidates = ranked.filter((f) => top - scores[f] < TIE_EPSILON);
  const chosen = candidates[Math.floor(rng() * candidates.length)];

  // The double-secret cosmos: no upbringing summons it. Any pet that was about
  // to become *anything but a gremlin* has a flat 1% chance of instead being
  // quietly kept by the night sky — care is irrelevant, it's pure luck. Gremlins
  // are exempt: the sky doesn't collect those. Drawn from the *top* of the roll
  // so rng()=0 keeps its documented meaning ("no luck, take the top scorer").
  if (chosen !== "gremlin" && rng() >= 0.99) return "cosmos";
  return chosen;
}
