import { describe, expect, it } from "vitest";
import {
  MAX_HEARTS,
  TAP_ANNOY_THRESHOLD,
  applyElapsedDecay,
  clean,
  createPet,
  discipline,
  feed,
  giveMedicine,
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
    expect(later.hunger).toBe(MAX_HEARTS);
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

describe("stage advancement", () => {
  it("hatches egg → baby after the egg timer", () => {
    const pet = createPet("Milo", T0);
    const later = applyElapsedDecay(pet, T0 + 61_000);
    expect(later.stage).toBe("baby");
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
    const pet = asStage({ ...createPet("Milo", T0), sick: true }, "child");
    const { state, note } = giveMedicine(pet, T0);
    expect(state.sick).toBe(false);
    expect(note).toBe("cured");
  });

  it("is a care mistake when the pet is not sick", () => {
    const pet = asStage(createPet("Milo", T0), "child");
    const { note, state } = giveMedicine(pet, T0);
    expect(note).toBe("notneeded");
    expect(state.hidden.careMistakes).toBe(1);
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
  it("becomes annoyed after rapid taps", () => {
    let pet = asStage(createPet("Milo", T0), "child");
    let annoyed = false;
    for (let i = 0; i < TAP_ANNOY_THRESHOLD; i++) {
      const r = tap(pet, T0 + i * 100);
      pet = r.state;
      annoyed = r.annoyed;
    }
    expect(annoyed).toBe(true);
  });

  it("answers a genuine attention call", () => {
    const pet = asStage(
      { ...createPet("Milo", T0), wantsAttention: true, fakeCall: false },
      "child",
    );
    const r = tap(pet, T0);
    expect(r.answered).toBe(true);
    expect(r.state.wantsAttention).toBe(false);
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
