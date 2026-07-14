import { describe, expect, it } from "vitest";
import { applyDevAction } from "./devtools";
import { ADULT_LIFESPAN_MS, createPet, retirementPhase } from "./state";
import type { PetState } from "./types";

/** Local wall-clock time on a fixed summer Monday — same convention as
 *  state.test.ts, since applyDevAction settles elapsed decay first. */
function at(hour: number, minute = 0): number {
  return new Date(2026, 5, 15, hour, minute).getTime();
}
const T0 = at(10);

function asStage(pet: PetState, stage: PetState["stage"]): PetState {
  return { ...pet, stage, stageStartedAt: pet.lastUpdated };
}

describe("timeline lever", () => {
  it("switches timelines and logs the change", () => {
    const pet = asStage(createPet("Milo", T0), "child");
    const demo = applyDevAction(pet, { type: "timeline", timeline: "demo" }, T0);
    expect(demo.timeline).toBe("demo");
    expect(demo.diag.some((d) => d.kind === "timeline" && d.note === "demo")).toBe(true);
    const real = applyDevAction(demo, { type: "timeline", timeline: "real" }, T0);
    expect(real.timeline).toBe("real");
  });

  it("switching to the current timeline is a no-op", () => {
    const pet = asStage(createPet("Milo", T0), "child");
    const same = applyDevAction(pet, { type: "timeline", timeline: "real" }, T0);
    expect(same.diag.some((d) => d.kind === "timeline")).toBe(false);
  });

  it("never mutates the input state", () => {
    const pet = asStage(createPet("Milo", T0), "child");
    const diagLen = pet.diag.length;
    applyDevAction(pet, { type: "timeline", timeline: "demo" }, T0);
    expect(pet.timeline).toBe("real");
    expect(pet.diag.length).toBe(diagLen);
  });
});

describe("stat levers", () => {
  it("sets a stat outright and logs it", () => {
    const pet = asStage(createPet("Milo", T0), "child");
    const next = applyDevAction(pet, { type: "stat", stat: "health", value: 50 }, T0);
    expect(next.health).toBe(50);
    expect(next.diag.some((d) => d.kind === "dev" && d.note === "health set to 50")).toBe(true);
  });

  it("clamps to each stat's own range", () => {
    const pet = asStage(createPet("Milo", T0), "child");
    expect(applyDevAction(pet, { type: "stat", stat: "energy", value: 99 }, T0).energy).toBe(4);
    expect(applyDevAction(pet, { type: "stat", stat: "health", value: -5 }, T0).health).toBe(0);
    expect(applyDevAction(pet, { type: "stat", stat: "weight", value: 0 }, T0).weight).toBe(1);
  });

  it("setting a stat to its current value is a no-op", () => {
    const pet = asStage(createPet("Milo", T0), "child");
    const same = applyDevAction(pet, { type: "stat", stat: "energy", value: pet.energy }, T0);
    expect(same.diag.some((d) => d.kind === "dev")).toBe(false);
  });
});

describe("hidden ledger levers", () => {
  it("nudges a hidden counter and logs the move", () => {
    const pet = asStage(createPet("Milo", T0), "child");
    const next = applyDevAction(pet, { type: "hidden", stat: "careMistakes", delta: 1 }, T0);
    expect(next.hidden.careMistakes).toBe(1);
    expect(
      next.diag.some((d) => d.kind === "dev" && d.note === "hidden careMistakes 0 → 1"),
    ).toBe(true);
  });

  it("floors at zero rather than going negative", () => {
    const pet = asStage(createPet("Milo", T0), "child");
    const same = applyDevAction(pet, { type: "hidden", stat: "nightCare", delta: -1 }, T0);
    expect(same.hidden.nightCare).toBe(0);
    expect(same.diag.some((d) => d.kind === "dev")).toBe(false);
  });

  it("never mutates the input's hidden stats", () => {
    const pet = asStage(createPet("Milo", T0), "child");
    applyDevAction(pet, { type: "hidden", stat: "cakeEaten", delta: 3 }, T0);
    expect(pet.hidden.cakeEaten).toBe(0);
  });
});

describe("forced messes", () => {
  it("drops a mess on the floor and logs it", () => {
    const pet = asStage(createPet("Milo", T0), "child");
    const next = applyDevAction(pet, { type: "poop", bad: false }, T0);
    expect(next.poops).toBe(1);
    expect(next.hasBadPoop).toBe(false);
    expect(next.diag.some((d) => d.kind === "poop" && d.note?.includes("(dev)"))).toBe(true);
  });

  it("a bad mess flags the lingering sickness risk", () => {
    const pet = asStage(createPet("Milo", T0), "child");
    const next = applyDevAction(pet, { type: "poop", bad: true }, T0);
    expect(next.poops).toBe(1);
    expect(next.hasBadPoop).toBe(true);
  });
});

describe("forced illness", () => {
  it("inflicts the named illness with fresh treatment bookkeeping", () => {
    const pet = asStage(createPet("Milo", T0), "child");
    const next = applyDevAction(pet, { type: "illness", illness: "plague" }, T0);
    expect(next.sick).toBe(true);
    expect(next.illness).toBe("plague");
    expect(next.dosesGiven).toBe(0);
    expect(next.diag.some((d) => d.kind === "sick" && d.note === "plague (dev)")).toBe(true);
  });

  it("dysentery owes its guaranteed first accident, same as the organic roll", () => {
    const pet = asStage(createPet("Milo", T0), "child");
    const next = applyDevAction(pet, { type: "illness", illness: "dysentery" }, T0);
    expect(next.dysenteryPoopOwed).toBe(true);
  });

  it("won't stack a second illness on an already-sick pet", () => {
    const pet = asStage(createPet("Milo", T0), "child");
    const sick = applyDevAction(pet, { type: "illness", illness: "sniffles" }, T0);
    const again = applyDevAction(sick, { type: "illness", illness: "plague" }, T0);
    expect(again.illness).toBe("sniffles");
  });
});

describe("forced attention calls", () => {
  it("raises a genuine call with a want and a start time", () => {
    const pet = asStage(createPet("Milo", T0), "child");
    const next = applyDevAction(pet, { type: "call", fake: false }, T0);
    expect(next.wantsAttention).toBe(true);
    expect(next.fakeCall).toBe(false);
    expect(["pat", "play", "snack"]).toContain(next.attentionWant);
    expect(next.callStartedAt).toBe(T0);
  });

  it("a fake call never counterfeits a pat — same menu as stepEvents", () => {
    const pet = asStage(createPet("Milo", T0), "teen");
    for (let i = 0; i < 40; i++) {
      const next = applyDevAction(pet, { type: "call", fake: true }, T0);
      expect(next.fakeCall).toBe(true);
      expect(["play", "snack"]).toContain(next.attentionWant);
    }
  });

  it("won't raise a call over an active one", () => {
    const pet = asStage(createPet("Milo", T0), "teen");
    const called = applyDevAction(pet, { type: "call", fake: false }, T0);
    const want = called.attentionWant;
    const again = applyDevAction(called, { type: "call", fake: true }, T0);
    expect(again.fakeCall).toBe(false);
    expect(again.attentionWant).toBe(want);
  });
});

describe("forced zoomies", () => {
  it("starts a burst with its clock running", () => {
    const pet = asStage(createPet("Milo", T0), "child");
    const next = applyDevAction(pet, { type: "zoomies" }, T0);
    expect(next.zoomies).toBe(true);
    expect(next.zoomiesStartedAt).toBe(T0);
  });
});

describe("forced growth", () => {
  it("advances one stage and logs the transition", () => {
    const pet = asStage(createPet("Milo", T0), "child");
    const next = applyDevAction(pet, { type: "grow" }, T0);
    expect(next.stage).toBe("teen");
    expect(next.stageElapsedMs).toBe(0);
    expect(next.diag.some((d) => d.kind === "stage" && d.note === "teen")).toBe(true);
  });

  it("growing an adult does nothing", () => {
    const pet = asStage(createPet("Milo", T0), "adult");
    const next = applyDevAction(pet, { type: "grow" }, T0);
    expect(next.stage).toBe("adult");
  });

  it("teen grows into an adult with a form", () => {
    const pet = asStage(createPet("Milo", T0), "teen");
    const next = applyDevAction(pet, { type: "grow" }, T0);
    expect(next.stage).toBe("adult");
    expect(next.form).not.toBeNull();
  });
});

describe("forced retirement readiness", () => {
  it("fills the adult's retirement clock", () => {
    const pet = asStage(createPet("Milo", T0), "adult");
    const next = applyDevAction(pet, { type: "retire-ready" }, T0);
    expect(next.adultLifeMs).toBe(ADULT_LIFESPAN_MS);
    expect(retirementPhase(next)).toBe("ready");
  });

  it("does nothing before adulthood", () => {
    const pet = asStage(createPet("Milo", T0), "teen");
    const next = applyDevAction(pet, { type: "retire-ready" }, T0);
    expect(next.adultLifeMs).toBe(0);
  });
});
