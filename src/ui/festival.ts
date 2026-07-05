// Some evenings the farm strings up lanterns and holds a little festival.
// Whether tonight is one is deterministic per calendar evening — reopening
// the panel mid-party never flips the scene back to daylight.

function hashDate(d: Date): number {
  const s = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

/** True on festival nights: 7pm to 5am, roughly one evening in four.
 *  Set localStorage "cozy-sprites-festival" to "1"/"0" to force it for a peek. */
export function festivalTonight(now: Date = new Date()): boolean {
  if (typeof localStorage !== "undefined") {
    const forced = localStorage.getItem("cozy-sprites-festival");
    if (forced === "1") return true;
    if (forced === "0") return false;
  }
  const hour = now.getHours();
  if (hour >= 5 && hour < 19) return false;
  // Past midnight the party still belongs to yesterday's evening — it winds
  // down at dawn, not at 12:00 sharp.
  const evening = new Date(now);
  if (hour < 5) evening.setDate(evening.getDate() - 1);
  return hashDate(evening) % 4 === 0;
}
