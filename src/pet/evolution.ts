// Hidden evolution scoring (SPEC §4, §7). The player never sees these numbers —
// they learn the influences empirically ("too much cake made a blob"). We score
// every candidate adult from the hidden stats and take the highest.

import type { AdultForm, GameId, HiddenStats } from "./types";

function mostPlayed(plays: Record<GameId, number>): { game: GameId; count: number } {
  let best: GameId = "fetch";
  let count = -1;
  (Object.keys(plays) as GameId[]).forEach((g) => {
    if (plays[g] > count) {
      count = plays[g];
      best = g;
    }
  });
  return { game: best, count };
}

export function scoreForms(
  hidden: HiddenStats,
  health: number,
): Record<AdultForm, number> {
  const { game: topGame, count: topCount } = mostPlayed(hidden.gamePlays);
  const hasTopGame = topCount > 0;
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
  };

  // Loyal Dog Thing — fetch enthusiast, well cared for.
  if (hasTopGame && topGame === "fetch") {
    s.dog += 4;
    if (wellCared) s.dog += 3;
    s.dog -= mistakes;
  }

  // Dramatic Blob — cake habit + a bit of drama/neglect.
  s.blob += hidden.cakeEaten * 1.5;
  if (hasTopGame && topGame === "higherlower") s.blob += 1;
  if (mistakes >= 2 && mistakes < 6) s.blob += 2;

  // Gremlin — chaos: cube abuse, care mistakes, low discipline.
  s.gremlin += hidden.cubeEaten * 1.2;
  s.gremlin += mistakes * 0.8;
  if ((hidden.cubeEaten > 0 || mistakes > 0) && hidden.discipline < 10) {
    s.gremlin += 2;
  }

  // Little Scholar — disciplined, curious, cake-averse.
  s.scholar += hidden.discipline * 0.15;
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

  return s;
}

export function determineAdultForm(
  hidden: HiddenStats,
  health: number,
): AdultForm {
  const scores = scoreForms(hidden, health);
  let best: AdultForm = "office";
  let bestScore = -Infinity;
  (Object.keys(scores) as AdultForm[]).forEach((f) => {
    if (scores[f] > bestScore) {
      bestScore = scores[f];
      best = f;
    }
  });
  return best;
}
