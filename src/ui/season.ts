// Which season the meadow wears. True to the real calendar — meteorological,
// northern-hemisphere flavored, and the meadow does not take hemisphere
// corrections (same stance as weather.ts, whose snow gate keys off this).
// Cosmetic only, same promise as weather: a season never touches the care math.

export type Season = "spring" | "summer" | "fall" | "winter";

/** The Dev Tools season lever: "auto" follows the calendar, anything else pins
 *  the meadow (and the wet-day flavor) to that season. Unlike the sky pin this
 *  one persists in localStorage — a forced season is meant to survive a reload
 *  so you can keep poking at it. */
export type SeasonMode = "auto" | Season;

const OVERRIDE_KEY = "cozy-sprites-season";

function readOverride(): Season | null {
  if (typeof localStorage === "undefined") return null;
  const forced = localStorage.getItem(OVERRIDE_KEY);
  if (forced === "spring" || forced === "summer" || forced === "fall" || forced === "winter") {
    return forced;
  }
  return null;
}

/** Today's season. A forced override (see setSeasonMode / the Dev Tools lever)
 *  wins; otherwise it's meteorological, northern-hemisphere. */
export function seasonToday(now: Date = new Date()): Season {
  const forced = readOverride();
  if (forced) return forced;
  const m = now.getMonth();
  if (m === 11 || m <= 1) return "winter";
  if (m <= 4) return "spring";
  if (m <= 7) return "summer";
  return "fall";
}

/** Which season lever is set: the pinned season, or "auto" for the calendar. */
export function getSeasonMode(): SeasonMode {
  return readOverride() ?? "auto";
}

/** Pin the season, or clear the pin back to the calendar with "auto". */
export function setSeasonMode(mode: SeasonMode): void {
  if (typeof localStorage === "undefined") return;
  if (mode === "auto") localStorage.removeItem(OVERRIDE_KEY);
  else localStorage.setItem(OVERRIDE_KEY, mode);
}
