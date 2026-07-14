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
  advanceOne,
  applyElapsedDecay,
  logEvent,
} from "./state";

export type DevAction =
  | { type: "timeline"; timeline: Timeline }
  | { type: "poop"; bad: boolean }
  | { type: "illness"; illness: IllnessId }
  | { type: "call"; fake: boolean }
  | { type: "zoomies" }
  | { type: "grow" }
  | { type: "retire-ready" };

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
