// Which season the meadow wears. For now a stub: always summer unless forced —
// whether seasons track the real calendar or each pet's own life is still an
// open design question, and the renderer doesn't care where the answer comes
// from. Cosmetic only, same promise as weather.ts: a season never touches the
// care math.

export type Season = "spring" | "summer" | "fall" | "winter";

/** Today's season. Set localStorage "cozy-sprites-season" to
 *  "spring"/"summer"/"fall"/"winter" to force it for a peek. */
export function seasonToday(): Season {
  if (typeof localStorage !== "undefined") {
    const forced = localStorage.getItem("cozy-sprites-season");
    if (forced === "spring" || forced === "summer" || forced === "fall" || forced === "winter") {
      return forced;
    }
  }
  return "summer";
}
