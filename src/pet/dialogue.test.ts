import { describe, expect, it } from "vitest";
import {
  dyingLine,
  farmConfirmLine,
  illnessAnnouncement,
  isDying,
  memorialLine,
  pickLine,
  shouldSpeak,
  speakChance,
} from "./dialogue";
import { createPet } from "./state";
import type { PetState } from "./types";

const T0 = 1_700_000_000_000;

function petAt(stage: PetState["stage"], form: PetState["form"] = null): PetState {
  return { ...createPet("Milo", T0), stage, form };
}

describe("chattiness", () => {
  it("always speaks for important feedback", () => {
    expect(speakChance(petAt("teen"), "sick")).toBe(1);
    expect(speakChance(petAt("teen"), "win")).toBe(1);
    expect(speakChance(petAt("adult", "ghost"), "call")).toBe(1);
  });

  it("routine chatter is throttled and varies by stage", () => {
    expect(speakChance(petAt("teen"), "tap")).toBeLessThan(
      speakChance(petAt("child"), "tap"),
    );
  });

  it("varies by adult form — the dog talks more than the ghost", () => {
    expect(speakChance(petAt("adult", "dog"), "idle")).toBeGreaterThan(
      speakChance(petAt("adult", "ghost"), "idle"),
    );
  });

  it("shouldSpeak respects the roll", () => {
    expect(shouldSpeak(petAt("teen"), "tap", () => 0.99)).toBe(false);
    expect(shouldSpeak(petAt("teen"), "tap", () => 0.0)).toBe(true);
  });
});

describe("illness + memorial copy", () => {
  it("announces illnesses Oregon-Trail style", () => {
    expect(illnessAnnouncement("Milo", "dysentery", () => 0)).toBe(
      "Milo has dysentery.",
    );
  });

  it("writes the memorial line with a cause", () => {
    expect(memorialLine("Milo", "the plague")).toBe("Milo has died of the plague.");
  });
});

describe("farm confirmation lines", () => {
  it("has distinct lines for every stage", () => {
    const stages: PetState["stage"][] = ["egg", "baby", "child", "teen", "adult"];
    const lines = stages.map((s) => farmConfirmLine(s, () => 0));
    expect(new Set(lines).size).toBe(stages.length);
  });
});

describe("dying dialogue", () => {
  it("triggers on low health or an active doom clock, but never after death", () => {
    expect(isDying({ ...petAt("adult"), health: 10 })).toBe(true);
    expect(isDying({ ...petAt("adult"), health: 50, zeroHealthMs: 1 })).toBe(true);
    expect(isDying({ ...petAt("adult"), health: 50 })).toBe(false);
    expect(isDying({ ...petAt("adult"), health: 0, deadAt: T0 })).toBe(false);
  });

  it("names the circumstance — sickness beats hunger beats loneliness", () => {
    const base = { ...petAt("adult"), health: 5 };
    expect(dyingLine({ ...base, sick: true, hunger: 0 }, () => 0)).toBe(
      "The end is near.",
    );
    expect(dyingLine({ ...base, hunger: 0 }, () => 0)).toBe("So... hungry...");
    expect(dyingLine({ ...base, hunger: 3, happiness: 0 }, () => 0)).toBe(
      "It's so quiet...",
    );
    expect(dyingLine({ ...base, hunger: 3, happiness: 3 }, () => 0)).toBe(
      "The end is near.",
    );
  });
});

describe("clean_nothing", () => {
  it("always comments when you sweep a clean floor", () => {
    expect(speakChance(petAt("adult", "ghost"), "clean_nothing")).toBe(1);
    expect(pickLine(petAt("child"), "clean_nothing", () => 0)).toBeTruthy();
  });
});

describe("pickLine", () => {
  it("uses the adult form's own voice when available", () => {
    const line = pickLine(petAt("adult", "ghost"), "idle", () => 0);
    expect(line).toBe("...");
  });

  it("falls back to the general bank for uncovered categories", () => {
    const line = pickLine(petAt("adult", "ghost"), "clean", () => 0);
    expect(line).toBeTruthy();
  });
});
