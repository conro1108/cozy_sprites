import { describe, expect, it } from "vitest";
import { buildHistory, historyTruncated } from "./history";
import { createPet } from "./state";
import type { DiagEvent, PetState, VitalsSample } from "./types";

const T0 = new Date(2026, 0, 10, 9, 0, 0).getTime(); // a Saturday morning
const HOUR = 3_600_000;
const DAY = 24 * HOUR;

/** A pet whose whole recorded trail is exactly the events given. */
function withDiag(diag: DiagEvent[], vitals: VitalsSample[] = []): PetState {
  return {
    ...createPet("Milo", T0),
    diag,
    diagTotal: diag.length,
    vitals,
    vitalsTotal: vitals.length,
  };
}

/** Flatten to the rendered text of every row, newest first. */
function texts(pet: PetState, includeVitals = false, now = T0): string[] {
  return buildHistory(pet, { includeVitals }, now).flatMap((d) => d.rows.map((r) => r.text));
}

describe("buildHistory", () => {
  it("renders events in plain language rather than raw notes", () => {
    const pet = withDiag([
      { t: T0, kind: "fed", note: "cake" },
      { t: T0 + 1, kind: "played", note: "fetch win" },
      { t: T0 + 2, kind: "sick", note: "plague" },
      { t: T0 + 3, kind: "cleaned", note: "2 swept" },
    ]);
    const out = texts(pet);
    expect(out).toContain("Fed a Cake");
    expect(out).toContain("Played Fetch — you won");
    expect(out).toContain("Came down with the plague");
    expect(out).toContain("Cleaned up 2 messes");
    // Nothing should leak the raw note format.
    expect(out.join("\n")).not.toContain("fetch win");
  });

  it("names the adult form on the transition that carries it", () => {
    const pet = withDiag([
      { t: T0, kind: "stage", note: "teen" },
      {
        t: T0 + 1,
        kind: "stage",
        note: "adult (dog) — mistakes 1, discipline 20, nightCare 0, cake 0, cube 0, carrot 0, health 90",
      },
    ]);
    const out = texts(pet);
    expect(out).toContain("Grew into a teen");
    expect(out).toContain("Grew up into the Loyal Dog Thing");
  });

  it("tells a match tie apart from a win and a loss", () => {
    const pet = withDiag([
      { t: T0, kind: "played", note: "rps tie" },
      { t: T0 + 1, kind: "played", note: "rps loss" },
      { t: T0 + 2, kind: "played", note: "rps win" },
    ]);
    const out = texts(pet);
    expect(out).toContain("Played Rock Paper Scissors — a tie");
    expect(out).toContain("Played Rock Paper Scissors — you lost");
    expect(out).toContain("Played Rock Paper Scissors — you won");
  });

  it("reports how far an endless game got instead of a win/loss", () => {
    const pet = withDiag([{ t: T0, kind: "played", note: "cubehum reach 7" }]);
    expect(texts(pet)).toContain("Played The Cube's Hum — reached round 7");
  });

  it("distinguishes a genuine call from a faked one", () => {
    const pet = withDiag([
      { t: T0, kind: "call", note: "raised:real play" },
      { t: T0 + 1, kind: "call", note: "raised:fake pat" },
    ]);
    const out = texts(pet).join("\n");
    expect(out).toContain("Called for a game");
    expect(out).toContain("didn't mean it");
  });

  it("orders newest first and groups by day", () => {
    const pet = withDiag([
      { t: T0 - DAY, kind: "hatched" },
      { t: T0 - 2 * HOUR, kind: "zoomies" },
      { t: T0, kind: "poop" },
    ]);
    const days = buildHistory(pet, {}, T0);
    expect(days.map((d) => d.label)).toEqual(["Today", "Yesterday"]);
    // Within the day, newest first too.
    expect(days[0].rows.map((r) => r.text)).toEqual(["Made a mess", "Got the zoomies"]);
    expect(days[1].rows.map((r) => r.text)).toEqual(["Hatched"]);
  });

  it("leaves the numeric vitals out unless they're asked for", () => {
    const vitals: VitalsSample[] = [
      {
        t: T0,
        health: 72,
        energy: 3.14,
        happiness: 2,
        weight: 5.4,
        poops: 1,
        illness: null,
        asleep: false,
        lightsOn: true,
        zeroHealthMs: 0,
        careMistakes: 1,
      },
    ];
    const pet = withDiag([{ t: T0, kind: "poop" }], vitals);
    expect(texts(pet, false).some((t) => t.includes("health"))).toBe(false);
    const shown = texts(pet, true);
    expect(shown.some((t) => t.includes("health 72"))).toBe(true);
    // Rounded for reading, not dumped raw.
    expect(shown.some((t) => t.includes("3.14"))).toBe(false);
  });

  it("has nothing to show for a pet with no recorded trail", () => {
    expect(buildHistory(withDiag([]), {}, T0)).toEqual([]);
  });

  it("flags a trail whose oldest entries have been evicted", () => {
    const pet = withDiag([{ t: T0, kind: "poop" }]);
    expect(historyTruncated(pet)).toBe(false);
    expect(historyTruncated({ ...pet, diagTotal: 9000 })).toBe(true);
  });
});
