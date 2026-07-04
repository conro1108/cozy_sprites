import { describe, expect, it } from "vitest";
import {
  DAY_CYCLE_MS,
  DEATH_AFTER_ZERO_HEALTH_MS,
  MAX_HEARTS,
  TAP_ANNOY_THRESHOLD,
  applyElapsedDecay,
  applyGameResult,
  clean,
  createPet,
  discipline,
  feed,
  giveMedicine,
  isNight,
  rollIllness,
  stepEvents,
  tap,
} from "./state";
import type { PetState } from "./types";

const T0 = 1_700_000_000_000;

/** Advance a pet to a given stage for tests that need past-egg behaviour. */
function asStage(pet: PetState, stage: PetState["stage"]): PetState {
  return { ...pet, stage, stageStartedAt: pet.lastUpdated };
}

describe("applyElapsedDecay", () => {
  it("does nothing when no time passes", () => {
    const pet = asStage(createPet("Milo", T0), "child");
    expect(applyElapsedDecay(pet, T0)).toBe(pet);
  });

  it("freezes stats during the egg stage", () => {
    const pet = createPet("Milo", T0);
    const later = applyElapsedDecay(pet, T0 + 30_000);
    expect(later.hunger).toBe(pet.hunger);
  });

  it("decays hunger over time once hatched", () => {
    const pet = asStage(createPet("Milo", T0), "child");
    const later = applyElapsedDecay(pet, T0 + 20 * 60_000);
    expect(later.hunger).toBeLessThan(MAX_HEARTS);
  });

  it("clamps stats at zero after a long absence", () => {
    const pet = asStage(createPet("Milo", T0), "child");
    const later = applyElapsedDecay(pet, T0 + 5 * 24 * 60 * 60_000);
    expect(later.hunger).toBe(0);
    expect(later.happiness).toBe(0);
  });

  it("accrues hidden care mistakes while a need is at zero", () => {
    const starving = asStage({ ...createPet("Milo", T0), hunger: 0 }, "child");
    const later = applyElapsedDecay(starving, T0 + 5 * 60_000);
    expect(later.hidden.careMistakes).toBeGreaterThan(0);
  });
});

describe("day/night cycle", () => {
  // A moment 5s before dawn (still night), and 5s after (day has broken).
  const nightT = Math.floor(T0 / DAY_CYCLE_MS) * DAY_CYCLE_MS + DAY_CYCLE_MS - 5_000;
  const dawnT = nightT + 10_000;

  function sleeping(): PetState {
    return asStage(
      { ...createPet("Milo", nightT), lightsOn: false, asleep: true },
      "child",
    );
  }

  it("confirms the fixture actually straddles the night/day boundary", () => {
    expect(isNight(nightT)).toBe(true);
    expect(isNight(dawnT)).toBe(false);
  });

  it("relights the lantern and wakes the pet on its own at dawn", () => {
    const later = applyElapsedDecay(sleeping(), dawnT);
    expect(later.lightsOn).toBe(true);
    expect(later.asleep).toBe(false);
  });

  it("leaves the light off if it's still night", () => {
    const later = applyElapsedDecay(sleeping(), nightT + 1_000);
    expect(later.lightsOn).toBe(false);
    expect(later.asleep).toBe(true);
  });
});

describe("stage advancement", () => {
  it("hatches egg → baby after the egg timer", () => {
    const pet = createPet("Milo", T0);
    const later = applyElapsedDecay(pet, T0 + 61_000);
    expect(later.stage).toBe("baby");
  });

  it("hatches into a needy baby so care is immediately meaningful", () => {
    const pet = createPet("Milo", T0);
    const later = applyElapsedDecay(pet, T0 + 61_000);
    // Room in both meters for a feed/play to visibly fill.
    expect(later.hunger).toBeLessThanOrEqual(2);
    expect(later.happiness).toBeLessThanOrEqual(2);
  });

  it("decays the baby portion of a span that crosses the egg→baby boundary", () => {
    // Egg freezes stats, but once hatched the baby decays fast. A gap that
    // spans the boundary must decay the baby slice, not the whole span at the
    // egg's (zero) rate.
    const pet = createPet("Milo", T0);
    const past = applyElapsedDecay(pet, T0 + 61_000 + 60_000); // 1s into baby +1min
    expect(past.stage).toBe("baby");
    expect(past.hunger).toBeLessThan(MAX_HEARTS);
  });

  it("assigns an adult form on reaching adulthood", () => {
    const pet = createPet("Milo", T0);
    // Far enough that every stage timer elapses at once.
    const later = applyElapsedDecay(pet, T0 + 60 * 60_000);
    expect(later.stage).toBe("adult");
    expect(later.form).not.toBeNull();
  });
});

describe("feed", () => {
  it("restores hunger, clamped to max", () => {
    const pet = asStage({ ...createPet("Milo", T0), hunger: 1 }, "child");
    const { state } = feed(pet, "burger", T0);
    expect(state.hunger).toBe(3);
  });

  it("cannot feed during the egg stage", () => {
    const pet = createPet("Milo", T0);
    const { note } = feed(pet, "burger", T0);
    expect(note).toBe("cant");
  });

  it("tracks cake consumption as a hidden stat", () => {
    const pet = asStage(createPet("Milo", T0), "child");
    const { state } = feed(pet, "cake", T0);
    expect(state.hidden.cakeEaten).toBe(1);
  });

  it("refuses a proper meal when already full", () => {
    const pet = asStage({ ...createPet("Milo", T0), hunger: MAX_HEARTS }, "child");
    const { state, note } = feed(pet, "burger", T0);
    expect(note).toBe("full");
    expect(state.hunger).toBe(MAX_HEARTS);
    expect(state.weight).toBe(pet.weight);
  });

  it("still accepts a treat when full", () => {
    const pet = asStage(createPet("Milo", T0), "child");
    const { note, state } = feed(pet, "cake", T0);
    expect(note).not.toBe("full");
    expect(state.hidden.cakeEaten).toBe(1);
  });
});

describe("clean", () => {
  it("clears poops", () => {
    const pet = asStage({ ...createPet("Milo", T0), poops: 2 }, "child");
    const { state, note } = clean(pet, T0);
    expect(state.poops).toBe(0);
    expect(note).toBe("cleaned");
  });

  it("reports nothing to clean when floor is clear", () => {
    const pet = asStage(createPet("Milo", T0), "child");
    expect(clean(pet, T0).note).toBe("nothing");
  });
});

describe("giveMedicine", () => {
  it("cures a sick pet", () => {
    const pet = asStage(
      { ...createPet("Milo", T0), sick: true, illness: "sniffles" as const },
      "child",
    );
    const { state, note } = giveMedicine(pet, T0);
    expect(state.sick).toBe(false);
    expect(state.illness).toBeNull();
    expect(note).toBe("cured");
  });

  it("is a care mistake when the pet is not sick", () => {
    const pet = asStage(createPet("Milo", T0), "child");
    const { note, state } = giveMedicine(pet, T0);
    expect(note).toBe("notneeded");
    expect(state.hidden.careMistakes).toBe(1);
  });

  it("requires two doses to cure the plague", () => {
    const pet = asStage(
      { ...createPet("Milo", T0), sick: true, illness: "plague" as const },
      "child",
    );
    const first = giveMedicine(pet, T0);
    expect(first.note).toBe("dose");
    expect(first.state.sick).toBe(true);
    const second = giveMedicine(first.state, T0 + 1000);
    expect(second.note).toBe("cured");
    expect(second.state.sick).toBe(false);
    expect(second.state.dosesGiven).toBe(0);
  });
});

describe("illness", () => {
  it("assigns a named illness when a pet falls sick", () => {
    const pet = asStage({ ...createPet("Milo", T0), health: 10 }, "child");
    // rng() = 0 → poop fires first; run with rng always tiny so sick also fires
    const { state, events } = stepEvents(pet, 60_000, () => 0.001);
    expect(events).toContain("sick");
    expect(state.illness).not.toBeNull();
  });

  it("rolls the plague only from the rare tail of the table", () => {
    expect(rollIllness(() => 0.95)).toBe("plague");
    expect(rollIllness(() => 0.0)).toBe("sniffles");
  });

  it("keeps the sniffles the most common ailment", () => {
    // Sweep the whole [0,1) roll space; sniffles must win the largest slice.
    const counts: Record<string, number> = {};
    for (let i = 0; i < 1000; i++) {
      const id = rollIllness(() => i / 1000);
      counts[id] = (counts[id] ?? 0) + 1;
    }
    const ranked = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    expect(ranked[0][0]).toBe("sniffles");
    // The exotic ones sit in the rare tail, rarer than the sniffles.
    expect(counts["trimethylaminuria"] ?? 0).toBeLessThan(counts["sniffles"]);
    expect(counts["plague"] ?? 0).toBeLessThan(counts["sniffles"]);
  });
});

describe("death", () => {
  function doomed(): PetState {
    return asStage(
      { ...createPet("Milo", T0), health: 0, hunger: 0, happiness: 0 },
      "child",
    );
  }

  it("dies after sustained time at zero health", () => {
    const later = applyElapsedDecay(doomed(), T0 + DEATH_AFTER_ZERO_HEALTH_MS + 60_000);
    expect(later.deadAt).not.toBeNull();
    expect(later.causeOfDeath).toBeTruthy();
  });

  it("does not die immediately at zero health", () => {
    const later = applyElapsedDecay(doomed(), T0 + 30_000);
    expect(later.deadAt).toBeNull();
  });

  it("blames the illness when one is present", () => {
    const pet = { ...doomed(), sick: true, illness: "dysentery" as const };
    const later = applyElapsedDecay(pet, T0 + DEATH_AFTER_ZERO_HEALTH_MS + 60_000);
    expect(later.causeOfDeath).toBe("dysentery");
  });

  it("eggs cannot die", () => {
    const egg = { ...createPet("Milo", T0), health: 0 };
    const later = applyElapsedDecay(egg, T0 + 30_000);
    expect(later.deadAt).toBeNull();
  });

  it("dead pets no longer decay or act", () => {
    const dead = { ...doomed(), deadAt: T0, causeOfDeath: "dysentery" };
    const later = applyElapsedDecay(dead, T0 + 60 * 60_000);
    expect(later.stage).toBe("child");
    expect(feed(later, "burger", T0 + 61 * 60_000).note).toBe("cant");
    expect(stepEvents(later, 60_000, () => 0).events).toEqual([]);
  });
});

describe("discipline", () => {
  it("rewards correct discipline of a fake call", () => {
    const pet = asStage(
      { ...createPet("Milo", T0), wantsAttention: true, fakeCall: true },
      "teen",
    );
    const { state, note } = discipline(pet, T0);
    expect(note).toBe("correct");
    expect(state.hidden.discipline).toBeGreaterThan(0);
    expect(state.wantsAttention).toBe(false);
  });

  it("penalises incorrect discipline", () => {
    const pet = asStage(createPet("Milo", T0), "teen");
    const { state, note } = discipline(pet, T0);
    expect(note).toBe("incorrect");
    expect(state.hidden.careMistakes).toBe(1);
  });

  it("cannot discipline a baby", () => {
    const pet = asStage(createPet("Milo", T0), "baby");
    expect(discipline(pet, T0).note).toBe("cant");
  });
});

describe("tap", () => {
  it("reacts to the first poke, then ignores the next few", () => {
    let pet = asStage(createPet("Milo", T0), "child");
    const first = tap(pet, T0);
    expect(first.reaction).toBe("react");
    pet = first.state;
    const second = tap(pet, T0 + 100);
    expect(second.reaction).toBe("ignore");
  });

  it("becomes annoyed after rapid taps", () => {
    let pet = asStage(createPet("Milo", T0), "child");
    let reaction = "";
    for (let i = 0; i < TAP_ANNOY_THRESHOLD; i++) {
      const r = tap(pet, T0 + i * 100);
      pet = r.state;
      reaction = r.reaction;
    }
    expect(reaction).toBe("annoyed");
  });

  it("goes quiet again after complaining, instead of staying annoyed", () => {
    let pet = asStage(createPet("Milo", T0), "child");
    let reaction = "";
    for (let i = 0; i < TAP_ANNOY_THRESHOLD; i++) {
      const r = tap(pet, T0 + i * 100);
      pet = r.state;
      reaction = r.reaction;
    }
    expect(reaction).toBe("annoyed");

    // The full react -> ignore -> ... -> annoyed cycle should repeat, not
    // just the immediate next tap.
    const reactions: string[] = [];
    for (let i = 0; i < TAP_ANNOY_THRESHOLD; i++) {
      const r = tap(pet, T0 + (TAP_ANNOY_THRESHOLD + i) * 100);
      pet = r.state;
      reactions.push(r.reaction);
    }
    expect(reactions).toEqual(["react", "ignore", "ignore", "annoyed"]);
  });

  it("answers a genuine pat call", () => {
    const pet = asStage(
      { ...createPet("Milo", T0), wantsAttention: true, fakeCall: false, attentionWant: "pat" as const },
      "child",
    );
    const r = tap(pet, T0);
    expect(r.reaction).toBe("answered");
    expect(r.state.wantsAttention).toBe(false);
  });

  it("hints when the call wants something a poke isn't", () => {
    const pet = asStage(
      { ...createPet("Milo", T0), wantsAttention: true, fakeCall: false, attentionWant: "snack" as const },
      "child",
    );
    const r = tap(pet, T0);
    expect(r.reaction).toBe("hint");
    expect(r.want).toBe("snack");
    expect(r.state.wantsAttention).toBe(true); // still waiting for the snack
  });

  it("comforting a fake pat call spoils the pet (a care mistake)", () => {
    const pet = asStage(
      { ...createPet("Milo", T0), wantsAttention: true, fakeCall: true, attentionWant: "pat" as const },
      "teen",
    );
    const r = tap(pet, T0);
    expect(r.reaction).toBe("spoiled");
    expect(r.state.wantsAttention).toBe(false);
    expect(r.state.hidden.careMistakes).toBe(1);
  });
});

describe("attention wants", () => {
  it("feeding satisfies a genuine snack call", () => {
    const pet = asStage(
      { ...createPet("Milo", T0), hunger: 1, wantsAttention: true, fakeCall: false, attentionWant: "snack" as const },
      "child",
    );
    const { state, call } = feed(pet, "burger", T0);
    expect(call).toBe("satisfied");
    expect(state.wantsAttention).toBe(false);
  });

  it("feeding a fake snack call rewards the con", () => {
    const pet = asStage(
      { ...createPet("Milo", T0), hunger: 1, wantsAttention: true, fakeCall: true, attentionWant: "snack" as const },
      "teen",
    );
    const { state, call } = feed(pet, "burger", T0);
    expect(call).toBe("spoiled");
    expect(state.hidden.careMistakes).toBe(1);
  });

  it("a finished game satisfies a genuine play call", () => {
    const pet = asStage(
      { ...createPet("Milo", T0), wantsAttention: true, fakeCall: false, attentionWant: "play" as const },
      "child",
    );
    const { state, call } = applyGameResult(pet, "fetch", true, T0);
    expect(call).toBe("satisfied");
    expect(state.wantsAttention).toBe(false);
  });

  it("every new call comes with a want attached", () => {
    const pet = asStage(createPet("Milo", T0), "child");
    const { state, events } = stepEvents(pet, 60_000, () => 0.001);
    expect(events).toContain("call");
    expect(state.attentionWant).not.toBeNull();
  });
});

describe("stepEvents", () => {
  it("spawns a poop when rng is favourable", () => {
    const pet = asStage(createPet("Milo", T0), "baby");
    const { state, events } = stepEvents(pet, 60_000, () => 0);
    expect(events).toContain("poop");
    expect(state.poops).toBe(1);
  });

  it("produces no events during the egg stage", () => {
    const pet = createPet("Milo", T0);
    const { events } = stepEvents(pet, 60_000, () => 0);
    expect(events).toEqual([]);
  });
});
