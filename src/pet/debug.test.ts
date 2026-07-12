import { describe, expect, it } from "vitest";
import { formatDebugReport } from "./debug";
import { createPet } from "./state";
import type { PetState } from "./types";

const T0 = new Date(2026, 0, 1, 9, 0, 0).getTime();
const HOUR = 3_600_000;

describe("formatDebugReport", () => {
  it("includes a header with name, stage, and hatch time for a freshly hatched pet", () => {
    const pet = createPet("Milo", T0);
    const report = formatDebugReport(pet, T0);
    expect(report).toContain("Milo");
    expect(report).toContain("Stage: egg");
    expect(report).toContain("Status: alive");
    // createPet seeds a "hatched" diag entry, so the timeline isn't empty —
    // but a pet with genuinely no history should say so.
    const empty: PetState = { ...pet, diag: [], vitals: [] };
    expect(formatDebugReport(empty, T0)).toContain("(no history recorded yet)");
  });

  it("reports death with cause and lifespan instead of alive status", () => {
    const pet: PetState = {
      ...createPet("Milo", T0),
      stage: "adult",
      form: "dog",
      deadAt: T0 + 5 * HOUR,
      causeOfDeath: "an empty bowl",
    };
    const report = formatDebugReport(pet, T0 + 10 * HOUR);
    expect(report).toContain("Died:");
    expect(report).toContain("an empty bowl");
    expect(report).not.toContain("Status: alive");
  });

  it("reports retirement instead of death or alive status", () => {
    const pet: PetState = {
      ...createPet("Milo", T0),
      stage: "adult",
      form: "blob",
      departedAt: T0 + 5 * HOUR,
    };
    const report = formatDebugReport(pet, T0 + 10 * HOUR);
    expect(report).toContain("Retired:");
    expect(report).not.toContain("Status: alive");
    expect(report).not.toContain("Died:");
  });

  it("merges vitals and diag entries into one chronological timeline", () => {
    const pet: PetState = {
      ...createPet("Milo", T0),
      vitals: [
        { t: T0 + 2 * HOUR, health: 90, energy: 3, happiness: 3, weight: 5, poops: 0, illness: null, asleep: false, lightsOn: true, zeroHealthMs: 0, careMistakes: 0 },
      ],
      diag: [
        { t: T0, kind: "hatched" },
        { t: T0 + HOUR, kind: "fed", note: "burger" },
        { t: T0 + 3 * HOUR, kind: "sick", note: "sniffles" },
      ],
    };
    const report = formatDebugReport(pet, T0 + 4 * HOUR);
    const lines = report.split("\n");
    const idxHatched = lines.findIndex((l) => l.includes("hatched"));
    const idxFed = lines.findIndex((l) => l.includes("fed") && l.includes("burger"));
    const idxVitals = lines.findIndex((l) => l.includes("health=90"));
    const idxSick = lines.findIndex((l) => l.includes("sick") && l.includes("sniffles"));
    expect(idxHatched).toBeGreaterThan(-1);
    expect(idxFed).toBeGreaterThan(idxHatched);
    expect(idxVitals).toBeGreaterThan(idxFed);
    expect(idxSick).toBeGreaterThan(idxVitals);
  });

  it("counts vitals and diag lengths in the timeline header", () => {
    const pet: PetState = {
      ...createPet("Milo", T0),
      diag: [
        { t: T0, kind: "hatched" },
        { t: T0 + HOUR, kind: "fed", note: "cake" },
      ],
    };
    const report = formatDebugReport(pet, T0 + HOUR);
    expect(report).toContain("0 vitals samples, 2 events");
  });

  it("warns when the diag ring has evicted older events", () => {
    const pet: PetState = {
      ...createPet("Milo", T0),
      diag: [{ t: T0, kind: "hatched" }],
      diagTotal: 9_001, // far more logged over this pet's life than the ring holds
    };
    const report = formatDebugReport(pet, T0);
    expect(report).toMatch(/⚠ diag ring capped at 1.*9001 events logged.*oldest 9000 dropped/);
  });

  it("warns when the vitals ring has evicted older samples", () => {
    const pet: PetState = {
      ...createPet("Milo", T0),
      vitals: [
        { t: T0, health: 100, energy: 4, happiness: 4, weight: 5, poops: 0, illness: null, asleep: false, lightsOn: true, zeroHealthMs: 0, careMistakes: 0 },
      ],
      vitalsTotal: 4_500,
    };
    const report = formatDebugReport(pet, T0);
    expect(report).toMatch(/⚠ vitals ring capped at 1.*4500 samples logged.*oldest 4499 dropped/);
  });

  it("says nothing about capping when nothing has actually been dropped", () => {
    const pet = createPet("Milo", T0); // diagTotal === diag.length, vitalsTotal === vitals.length
    const report = formatDebugReport(pet, T0);
    expect(report).not.toContain("⚠");
  });
});
