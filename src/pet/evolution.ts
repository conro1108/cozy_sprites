// Hidden evolution scoring. The player never sees these numbers —
// they learn the influences empirically ("too much cake made a blob"). We score
// every candidate adult from the hidden stats and take the highest.

import type { AdultForm, GameId, HiddenStats } from "./types";

/**
 * The pet's favourite game — but only if it's *uniquely* most-played. Playing
 * everything equally is not an enthusiasm, and must not silently count as one
 * (it used to resolve to whichever game iterated first, biasing evolution).
 */
function mostPlayed(
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

export function scoreForms(
  hidden: HiddenStats,
  health: number,
): Record<AdultForm, number> {
  const { game: topGame, count: topCount, unique } = mostPlayed(hidden.gamePlays);
  const hasTopGame = topCount > 0 && unique;
  const mistakes = hidden.careMistakes;
  const wellCared = mistakes < 3 && health > 60;

  // Every personality bonus is gated behind actual evidence, so a pet that did
  // nothing notable resolves to the "unremarkable average": the office creature.
  const s: Record<AdultForm, number> = {
    dog: 0,
    blob: 0,
    gremlin: 0,
    scholar: 0,
    office: 2, // baseline: the default when nothing dominates
    menace: 0,
    ghost: 0,
    humcube: 0,
  };

  // Loyal Dog Thing — fetch enthusiast, well cared for. Ordinary wear and tear
  // (a couple of mistakes) shouldn't disqualify an otherwise devoted fetcher.
  if (hasTopGame && topGame === "fetch") {
    s.dog += 4;
    if (wellCared) s.dog += 3;
    s.dog -= mistakes * 0.5;
  }

  // Dramatic Blob — cake habit + a bit of drama/neglect.
  s.blob += hidden.cakeEaten * 1.5;
  if (hasTopGame && topGame === "higherlower") s.blob += 1;
  if (mistakes >= 2 && mistakes < 6) s.blob += 2;

  // Gremlin — chaos: care mistakes and low discipline, with a little cube.
  // The cube used to dominate this score, which made it read as a "bad" food.
  // It's meant to be neutral/mysterious: fed chaotically it still nudges the
  // gremlin, but its *devoted* path is the Humming Cube (below), not this one.
  s.gremlin += hidden.cubeEaten * 0.5;
  s.gremlin += mistakes * 0.9;
  if ((hidden.cubeEaten > 0 || mistakes > 0) && hidden.discipline < 10) {
    s.gremlin += 2;
  }

  // Little Scholar — disciplined, curious, cake-averse.
  s.scholar += hidden.discipline * 0.2;
  if (hasTopGame && topGame === "higherlower") s.scholar += 2;
  s.scholar -= hidden.cakeEaten;

  // Fancy Little Menace — high discipline + refined (cake) + low mistakes.
  s.menace += hidden.discipline * 0.12;
  s.menace += hidden.cakeEaten * 0.5;
  if (mistakes < 2 && (hidden.discipline > 20 || hidden.cakeEaten > 2)) {
    s.menace += 3;
  }

  // Office gets a small nudge from a moderate, balanced cake intake.
  s.office += Math.max(0, 2 - Math.abs(hidden.cakeEaten - 2));

  // Ghost (secret) — raised in the dark: care given with the lights off.
  // Deliberately steep so it only appears when night care truly dominates.
  s.ghost += hidden.nightCare * 0.9;
  if (hidden.nightCare >= 8) s.ghost += 3;

  // The Humming Cube (secret) — devotion to the cube, done calmly. A real cube
  // diet, and especially a habit of its humming game, without the gremlin's
  // chaos. Steep like the ghost: a casual cube taste won't summon it, but feed
  // the cube deliberately (and hum along) and something patient answers.
  s.humcube += hidden.cubeEaten * 0.5;
  if (hasTopGame && topGame === "cubehum") {
    s.humcube += 4;
    if (hidden.cubeEaten >= 3) s.humcube += 3; // the diet and the game together
  }

  return s;
}

/** How close two scores must be to count as "the upbringing didn't decide". */
const TIE_EPSILON = 0.5;

export function determineAdultForm(
  hidden: HiddenStats,
  health: number,
  rng: () => number = Math.random,
): AdultForm {
  const scores = scoreForms(hidden, health);
  // Sort descending so rng()=0 deterministically yields the top scorer.
  const ranked = (Object.keys(scores) as AdultForm[]).sort(
    (a, b) => scores[b] - scores[a],
  );
  // Near-ties break randomly — a raising style that didn't clearly commit
  // shouldn't produce the identical adult on every single run.
  const top = scores[ranked[0]];
  const candidates = ranked.filter((f) => top - scores[f] < TIE_EPSILON);
  return candidates[Math.floor(rng() * candidates.length)];
}
