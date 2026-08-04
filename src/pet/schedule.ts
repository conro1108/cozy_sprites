// Notification predictor. Simulates the pet forward on the wall clock and
// returns the deterministic care events that WILL happen if the player does
// nothing — the schedule a push backend fires while the app is closed.
//
// WHY THIS ONLY COVERS SOME NOTIFICATIONS
// The engine splits cleanly in two:
//   - applyElapsedDecay (state.ts) is pure, deterministic math — energy/
//     happiness decay, sleep, health, the retirement clock, the death clock.
//     Everything here is a function of elapsed wall-time and nothing else, so
//     it can be replayed into the future exactly.
//   - stepEvents (state.ts) is where the DICE are — falling ill, messing the
//     floor, raising an attention call are all rng rolls that haven't happened.
// You cannot honestly predict a coin that hasn't been flipped. Scheduling a
// "your pet is sick" push for a pet that rolls healthy would be a lie, and a
// lie is worse than silence. So the predictor mirrors exactly the subset of
// main.ts's stepPet() notifications that fall out of decay alone; the random
// ones keep notifying live-only, as they do today.
//
// The client re-runs this on every foreground/background and re-POSTs the
// result, so a fed pet's stale "getting hungry" push is replaced before it
// fires — the schedule is always relative to the latest known state.

import type { PetState } from "./types";
import { applyElapsedDecay, isNight, retirementPhase } from "./state";
import { memorialLine } from "./dialogue";

/** Matches NotifyKind in ui/notifications.ts, redeclared here to keep the pet
 *  layer free of any ui/ dependency. The sync layer passes it straight through. */
export type ScheduledKind = "dire" | "care";

export interface ScheduledNotification {
  /** Absolute wall-clock ms at which this should fire. */
  t: number;
  kind: ScheduledKind;
  title: string;
  body: string;
}

/** The app name every notification carries, matching main.ts's live calls. */
const TITLE = "The Meadow";

/** Simulation granularity. One wall-minute is far finer than a human notices in
 *  a "getting hungry" ping, and keeps a multi-day horizon to a few thousand
 *  cheap decay steps. */
const STEP_MS = 60_000;

/** Default look-ahead. The client re-syncs on every open, so this only has to
 *  outlast a plausible closed-app gap; three days comfortably does. */
const DEFAULT_HORIZON_MS = 3 * 24 * 3_600_000;

/**
 * Predict the decay-driven notifications between `from` and `from + horizonMs`.
 * `from` is normally Date.now() (passed in — this module never reads the clock,
 * so it stays pure and testable). Returns them in fire order. A dead or departed
 * pet, or one whose simulated life ends within the window, stops the walk.
 */
export function predictNotifications(
  state: PetState,
  from: number,
  horizonMs: number = DEFAULT_HORIZON_MS,
): ScheduledNotification[] {
  const out: ScheduledNotification[] = [];
  if (state.deadAt !== null || state.departedAt !== null) return out;

  const end = from + horizonMs;
  // Bring the pet up to `from` first, so the first simulated step compares
  // against its true present state rather than a stale save.
  let prev = applyElapsedDecay(state, from);
  let cursor = from;

  while (cursor < end && prev.deadAt === null && prev.departedAt === null) {
    const t = Math.min(cursor + STEP_MS, end);
    const next = applyElapsedDecay(prev, t);

    // 1) Getting hungry — energy falls to one heart. Mirrors stepPet's
    //    `prevEnergy > 1 && energy <= 1`. Energy only ever decreases without a
    //    feed, so this crosses at most once.
    if (prev.energy > 1 && next.energy <= 1) {
      out.push({ t, kind: "care", title: TITLE, body: `${next.name} is getting hungry.` });
    }

    // 2) Bedtime nudge at nightfall, lantern still lit. Mirrors stepPet's
    //    `!wasNight && isNight(now) && !asleep && stage!=egg`. If the pet is
    //    asleep at the crossing (lights already off) there's nothing to nudge.
    if (!isNight(cursor) && isNight(t) && !next.asleep && next.stage !== "egg") {
      out.push({ t, kind: "care", title: TITLE, body: `${next.name} is sleepy — lights out?` });
    }

    // 3) The long goodbye reaches its door.
    if (retirementPhase(prev) !== "ready" && retirementPhase(next) === "ready") {
      out.push({ t, kind: "care", title: TITLE, body: `${next.name} is ready for the farm.` });
    }

    // 4) Death from sustained neglect — the last, most important "come back"
    //    ping. causeOfDeath is set on the simulated state by applyElapsedDecay.
    if (prev.deadAt === null && next.deadAt !== null) {
      out.push({ t, kind: "dire", title: TITLE, body: memorialLine(next.name, next.causeOfDeath) });
    }

    prev = next;
    cursor = t;
  }

  return out;
}
