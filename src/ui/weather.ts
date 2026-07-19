// The day's weather over the meadow. Deterministic per calendar date — the
// same trick festival.ts uses, differently salted so a festival evening isn't
// secretly correlated with rain. Purely cosmetic plus dialogue flavor: weather
// never touches the care math, and it never will. A pet does not catch cold
// from pixels.

import { seasonToday } from "./season";

export type Weather = "clear" | "rain" | "snow";

function hashDate(d: Date): number {
  // Salted differently from festival.ts so the two rolls stay independent.
  const s = `wx:${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

/** Today's weather: wet roughly one day in five, snow when the season says
 *  winter (see ui/season.ts — so a forced-season peek gets matching skies).
 *  Set localStorage "cozy-sprites-weather" to "clear"/"rain"/"snow" to force
 *  it for a peek. */
export function weatherToday(now: Date = new Date()): Weather {
  if (typeof localStorage !== "undefined") {
    const forced = localStorage.getItem("cozy-sprites-weather");
    if (forced === "clear" || forced === "rain" || forced === "snow") return forced;
  }
  if (hashDate(now) % 5 !== 0) return "clear";
  return seasonToday(now) === "winter" ? "snow" : "rain";
}
