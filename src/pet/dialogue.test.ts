import { describe, expect, it } from "vitest";
import {
  farmConfirmLine,
  illnessAnnouncement,
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
