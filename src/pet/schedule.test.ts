import { describe, expect, it } from "vitest";
import { createPet, applyElapsedDecay, ADULT_LIFESPAN_MS } from "./state";
import { predictNotifications } from "./schedule";
import type { PetState } from "./types";

const HOUR = 3_600_000;

/** Local wall-clock on a fixed summer Monday (no DST). isNight() reads local
 *  hours, so fixtures are built this way — matches state.test.ts. */
function at(hour: number, minute = 0): number {
  return new Date(2026, 5, 15, hour, minute).getTime();
}
const T0 = at(10); // mid-morning, deep in the day window

/** A healthy adult, lantern lit, parked at `now`. The common fixture: adults
 *  decay at the 1× baseline, so timings are easy to reason about. */
function adult(now: number, over: Partial<PetState> = {}): PetState {
  return {
    ...createPet("Milo", now),
    stage: "adult",
    form: "dog",
    stageStartedAt: now,
    ...over,
  };
}

/** The four decay-driven bodies the predictor is allowed to emit. */
const KNOWN_BODIES = (name: string) => [
  `${name} is getting hungry.`,
  `${name} is sleepy — lights out?`,
  `${name} is ready for the farm.`,
  `${name} has died of an empty bowl.`,
  `${name} has died of a broken heart.`,
  `${name} has died of general neglect.`,
];

describe("predictNotifications", () => {
  it("schedules 'getting hungry' when energy will fall to one heart", () => {
    const pet = adult(T0, { energy: 3 });
    const out = predictNotifications(pet, T0);
    const hungry = out.filter((n) => n.body === "Milo is getting hungry.");
    expect(hungry).toHaveLength(1); // energy only decays — crosses once

    const n = hungry[0];
    expect(n.kind).toBe("care");
    expect(n.title).toBe("The Meadow");
    // ~1.75h out (2 hearts at ~1.14/hr), all within daylight.
    expect(n.t).toBeGreaterThan(T0 + 1.5 * HOUR);
    expect(n.t).toBeLessThan(T0 + 2 * HOUR);
    // And the crossing is real: energy is at/under a heart by then.
    expect(applyElapsedDecay(pet, n.t).energy).toBeLessThanOrEqual(1);
  });

  it("schedules the bedtime nudge at nightfall while the lantern is lit", () => {
    const pet = adult(at(18), { energy: 4, lightsOn: true }); // 6pm, topped up
    const out = predictNotifications(pet, at(18));
    const bed = out.filter((n) => n.body === "Milo is sleepy — lights out?");
    expect(bed.length).toBeGreaterThanOrEqual(1);

    const first = bed[0];
    // Fires at the 8pm night boundary, not before.
    expect(first.t).toBeGreaterThan(at(19, 55));
    expect(first.t).toBeLessThanOrEqual(at(20, 1));
  });

  it("does NOT nudge bedtime when the lantern is already off (pet asleep)", () => {
    const pet = adult(at(18), { energy: 4, lightsOn: false });
    const out = predictNotifications(pet, at(18));
    expect(out.some((n) => n.body.includes("lights out"))).toBe(false);
  });

  it("schedules 'ready for the farm' as the retirement clock tops out", () => {
    const pet = adult(T0, {
      energy: 4,
      happiness: 4,
      health: 90,
      adultLifeMs: ADULT_LIFESPAN_MS - 10 * 60_000, // ten game-minutes short
    });
    const out = predictNotifications(pet, T0);
    const ready = out.filter((n) => n.body === "Milo is ready for the farm.");
    expect(ready).toHaveLength(1);
    expect(ready[0].kind).toBe("care");
    expect(ready[0].t).toBeGreaterThan(T0);
  });

  it("schedules death as the final 'come back' ping for an abandoned pet", () => {
    const pet = adult(T0, { energy: 0, happiness: 0, health: 100 });
    const out = predictNotifications(pet, T0);
    const death = out.find((n) => n.body.startsWith("Milo has died"));
    expect(death).toBeDefined();
    expect(death!.kind).toBe("dire");
    // It's the last thing scheduled — nothing fires after the pet is gone.
    expect(death!.t).toBe(Math.max(...out.map((n) => n.t)));
  });

  it("returns nothing for a pet that is already gone", () => {
    expect(predictNotifications(adult(T0, { deadAt: T0 }), T0)).toEqual([]);
    expect(predictNotifications(adult(T0, { departedAt: T0 }), T0)).toEqual([]);
  });

  it("never invents the random events (sick / mess / attention)", () => {
    // A fully neglected pet across three days: every emitted body must be one
    // of the deterministic decay events — the dice-driven ones stay live-only.
    const pet = adult(T0, { energy: 0, happiness: 0, health: 30 });
    const out = predictNotifications(pet, T0);
    const allowed = new Set(KNOWN_BODIES("Milo"));
    for (const n of out) expect(allowed.has(n.body)).toBe(true);
  });

  it("returns events in fire order", () => {
    const out = predictNotifications(adult(T0, { energy: 3 }), T0);
    const times = out.map((n) => n.t);
    expect(times).toEqual([...times].sort((a, b) => a - b));
  });

  it("respects the horizon — a short window sees nothing yet", () => {
    // Energy won't reach one heart for ~1.75h, so a 30-minute look-ahead is empty.
    const out = predictNotifications(adult(T0, { energy: 3 }), T0, 30 * 60_000);
    expect(out).toEqual([]);
  });
});
