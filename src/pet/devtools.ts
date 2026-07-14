// Dev Tools levers: switch timelines and force the events the game normally
// rolls dice for (mess, illness, calls, zoomies, growing up). Pure and
// testable — the UI panel (menus.ts openDevTools) just dispatches DevActions
// through MenuCtx. Every lever settles elapsed time first (so a timeline
// switch banks time at the old speed) and logs through the same diag kinds
// the organic events use, so a forced illness reads in History exactly like
// a caught one.

import type { AttentionWant, IllnessId, PetState, Timeline } from "./types";
import {
  ADULT_LIFESPAN_MS,
  MAX_HEARTS,
  advanceOne,
  applyElapsedDecay,
  logEvent,
} from "./state";

/** The visible stats the panel can set outright. Clamped to each stat's own
 *  range on the way in, so the UI can dispatch raw stepper arithmetic. */
export type DevStat = "energy" | "happiness" | "health" | "discipline" | "weight";

/** The hidden ledger the panel can nudge — the inputs that steer which adult
 *  a teen becomes (see determineAdultForm), plus care mistakes. */
export type DevHidden =
  | "careMistakes"
  | "discipline"
  | "nightCare"
  | "cakeEaten"
  | "cubeEaten"
  | "carrotEaten";

export type DevAction =
  | { type: "timeline"; timeline: Timeline }
  | { type: "stat"; stat: DevStat; value: number }
  | { type: "hidden"; stat: DevHidden; delta: number }
  | { type: "poop"; bad: boolean }
  | { type: "illness"; illness: IllnessId }
  | { type: "call"; fake: boolean }
  | { type: "zoomies" }
  | { type: "grow" }
  | { type: "retire-ready" };

const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v));

/** Each settable stat's legal range. Weight has no hard ceiling in the game,
 *  but the lever stops at 20 — well past OVERWEIGHT, which is all a dev needs. */
export const DEV_STAT_RANGE: Record<DevStat, { min: number; max: number }> = {
  energy: { min: 0, max: MAX_HEARTS },
  happiness: { min: 0, max: MAX_HEARTS },
  health: { min: 0, max: 100 },
  discipline: { min: 0, max: 100 },
  weight: { min: 1, max: 20 },
};

const r1 = (v: number): number => Math.round(v * 10) / 10;

/** Apply one dev lever. Returns a new state (never mutates the input); levers
 *  that don't apply right now (growing an adult, sickening the sick…) hand the
 *  settled state back unchanged. */
export function applyDevAction(state: PetState, action: DevAction, now: number): PetState {
  // Settle time first — a timeline switch must bank the elapsed span at the
  // old speed, and a forced event should land on up-to-date stats. Then clone:
  // applyElapsedDecay returns its input untouched when no time has passed.
  const settled = applyElapsedDecay(state, now);
  const s: PetState = { ...settled, hidden: { ...settled.hidden }, diag: [...settled.diag] };

  switch (action.type) {
    case "timeline": {
      if (s.timeline === action.timeline) return settled;
      s.timeline = action.timeline;
      logEvent(s, now, "timeline", action.timeline);
      return s;
    }
    case "stat": {
      const { min, max } = DEV_STAT_RANGE[action.stat];
      const value = clamp(action.value, min, max);
      if (s[action.stat] === value) return settled;
      s[action.stat] = value;
      logEvent(s, now, "dev", `${action.stat} set to ${r1(value)}`);
      return s;
    }
    case "hidden": {
      const prev = s.hidden[action.stat];
      const value = Math.max(0, prev + action.delta);
      if (value === prev) return settled;
      s.hidden[action.stat] = value;
      logEvent(s, now, "dev", `hidden ${action.stat} ${r1(prev)} → ${r1(value)}`);
      return s;
    }
    case "poop": {
      s.poops++;
      logEvent(s, now, "poop", `now ${s.poops} on the floor (dev)`);
      if (action.bad) s.hasBadPoop = true;
      return s;
    }
    case "illness": {
      if (s.sick) return settled; // one ailment at a time, same as stepEvents
      s.sick = true;
      s.illness = action.illness;
      s.dosesGiven = 0;
      s.lastDoseAt = null;
      s.illnessMs = 0;
      if (action.illness === "dysentery") s.dysenteryPoopOwed = true;
      logEvent(s, now, "sick", `${action.illness} (dev)`);
      return s;
    }
    case "call": {
      if (s.wantsAttention) return settled;
      s.wantsAttention = true;
      s.fakeCall = action.fake;
      // Same menu as stepEvents: a fake call can only counterfeit hunger or
      // boredom — a pat is always a fair ask, so it's never the con.
      const wants: AttentionWant[] = action.fake ? ["play", "snack"] : ["pat", "play", "snack"];
      s.attentionWant = wants[Math.floor(Math.random() * wants.length)];
      s.callStartedAt = now;
      logEvent(s, now, "call", `raised:${action.fake ? "fake" : "real"} ${s.attentionWant} (dev)`);
      return s;
    }
    case "zoomies": {
      if (s.zoomies) return settled;
      s.zoomies = true;
      s.zoomiesStartedAt = now;
      logEvent(s, now, "zoomies", "(dev)");
      return s;
    }
    case "grow": {
      if (s.stage === "adult") return settled;
      advanceOne(s, now); // logs the stage transition itself
      return s;
    }
    case "retire-ready": {
      if (s.stage !== "adult" || s.adultLifeMs >= ADULT_LIFESPAN_MS) return settled;
      s.adultLifeMs = ADULT_LIFESPAN_MS;
      logEvent(s, now, "retirement", "ready (dev)");
      return s;
    }
  }
}
