// Which season the meadow wears. True to the real calendar — meteorological,
// northern-hemisphere flavored, and the meadow does not take hemisphere
// corrections (same stance as weather.ts, whose snow gate keys off this).
// Cosmetic only, same promise as weather: a season never touches the care math.

export type Season = "spring" | "summer" | "fall" | "winter";

/** Today's season. Set localStorage "cozy-sprites-season" to
 *  "spring"/"summer"/"fall"/"winter" to force it for a peek — the wet-day
 *  flavor follows (a forced winter snows where it would have rained). */
export function seasonToday(now: Date = new Date()): Season {
  if (typeof localStorage !== "undefined") {
    const forced = localStorage.getItem("cozy-sprites-season");
    if (forced === "spring" || forced === "summer" || forced === "fall" || forced === "winter") {
      return forced;
    }
  }
  const m = now.getMonth();
  if (m === 11 || m <= 1) return "winter";
  if (m <= 4) return "spring";
  if (m <= 7) return "summer";
  return "fall";
}
