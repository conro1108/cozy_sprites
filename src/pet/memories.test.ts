import { describe, expect, it } from "vitest";
import {
  eligibleMemories,
  memoryChance,
  memoryLine,
  MEMORY_MIN_AGE_MS,
} from "./memories";
import { createPet } from "./state";
import type { DiagEvent, PetState } from "./types";

const T0 = new Date(2026, 0, 10, 9, 0, 0).getTime();
const NOW = T0 + 10 * 24 * 3_600_000; // ten days on: everything below is "old"
const RECENT = NOW - MEMORY_MIN_AGE_MS / 2; // too fresh to be a memory yet

/** A grown pet with exactly the trail given. */
function adult(diag: DiagEvent[], patch: Partial<PetState> = {}): PetState {
  return {
    ...createPet("Milo", T0),
    stage: "adult",
    form: "scholar",
    diag,
    diagTotal: diag.length,
    ...patch,
  };
}

function kinds(pet: PetState): string[] {
  return eligibleMemories(pet, NOW).map((c) => c.kind);
}

describe("eligibleMemories", () => {
  it("is empty before adulthood — a memory needs a life behind it", () => {
    const pet = adult([{ t: T0, kind: "cured", note: "plague (medicine)" }], {
      stage: "teen",
      form: null,
    });
    expect(eligibleMemories(pet, NOW)).toEqual([]);
    expect(memoryChance(pet)).toBe(0);
  });

  it("every adult can at least reminisce about its childhood", () => {
    expect(kinds(adult([]))).toEqual(["childhood"]);
  });

  it("remembers a survived illness, but only once it's had time to settle", () => {
    const old = adult([{ t: T0, kind: "cured", note: "dysentery (medicine)" }]);
    expect(kinds(old)).toContain("illness");
    const fresh = adult([{ t: RECENT, kind: "cured", note: "dysentery (medicine)" }]);
    expect(kinds(fresh)).not.toContain("illness");
  });

  it("won't reminisce about the illness it currently has", () => {
    const pet = adult([{ t: T0, kind: "cured", note: "goblinflu (soup)" }], {
      sick: true,
      illness: "goblinflu",
    });
    expect(kinds(pet)).not.toContain("illness");
  });

  it("gives the plague and the folk cures their own tellings", () => {
    const plague = adult([{ t: T0, kind: "cured", note: "plague (medicine)" }]);
    const lines = eligibleMemories(plague, NOW).find((c) => c.kind === "illness")!.lines;
    expect(lines.join(" ")).toContain("plague");

    const soup = adult([{ t: T0, kind: "cured", note: "goblinflu (soup)" }]);
    const soupLines = eligibleMemories(soup, NOW).find((c) => c.kind === "illness")!.lines;
    expect(soupLines.join(" ")).toContain("soup");
  });

  it("recalls the zero-health scare only after recovery and distance", () => {
    const pet = adult([{ t: T0, kind: "recovered" }]);
    expect(kinds(pet)).toContain("scare");
    // Mid-crisis is not a memory.
    const inCrisis = adult([{ t: T0, kind: "recovered" }], { zeroHealthMs: 60_000 });
    expect(kinds(inCrisis)).not.toContain("scare");
  });

  it("counts games from the hidden tallies and picks a clear favorite", () => {
    const pet = adult([]);
    pet.hidden.gamePlays = {
      higherlower: 1,
      fetch: 9,
      rps: 2,
      hideseek: 0,
      wouldyou: 0,
      cubehum: 0,
    };
    const got = kinds(pet);
    expect(got).toContain("games"); // 12 total
    expect(got).toContain("favorite_game"); // fetch, uniquely
    const fav = eligibleMemories(pet, NOW).find((c) => c.kind === "favorite_game")!;
    expect(fav.lines[0]).toContain("Fetch");
    expect(fav.lines[0]).toContain("9");
  });

  it("keeps the best cube run, not the latest", () => {
    const pet = adult([
      { t: T0, kind: "played", note: "cubehum reach 7" },
      { t: T0 + 1, kind: "played", note: "cubehum reach 3" },
    ]);
    const rec = eligibleMemories(pet, NOW).find((c) => c.kind === "cube_record")!;
    expect(rec.lines[0]).toContain("7");
  });

  it("archives the most-fed food past a real habit's worth of meals", () => {
    const meals: DiagEvent[] = Array.from({ length: 8 }, (_, i) => ({
      t: T0 + i,
      kind: "fed" as const,
      note: "soup",
    }));
    const pet = adult(meals);
    const diet = eligibleMemories(pet, NOW).find((c) => c.kind === "diet")!;
    expect(diet.lines[0]).toContain("soup");
    expect(diet.lines[0]).toContain("8");
    // Seven meals is not yet an archive.
    expect(kinds(adult(meals.slice(1)))).not.toContain("diet");
  });

  it("tallies sweeps, fair scoldings, and night care from their sources", () => {
    const pet = adult(
      [
        { t: T0, kind: "cleaned", note: "6 swept" },
        { t: T0 + 1, kind: "cleaned", note: "4 swept" },
        { t: T0 + 2, kind: "discipline", note: "correct" },
        { t: T0 + 3, kind: "discipline", note: "correct" },
        { t: T0 + 4, kind: "discipline", note: "correct" },
        { t: T0 + 5, kind: "discipline", note: "incorrect" },
      ],
    );
    pet.hidden.nightCare = 3;
    const got = kinds(pet);
    expect(got).toContain("sweeps");
    expect(got).toContain("caught");
    expect(got).toContain("night_care");
    const caught = eligibleMemories(pet, NOW).find((c) => c.kind === "caught")!;
    expect(caught.lines[0]).toContain("3"); // incorrect scoldings don't count
  });
});

describe("memoryLine", () => {
  it("is deterministic under an injected rng", () => {
    const pet = adult([{ t: T0, kind: "cured", note: "vapors (nap)" }]);
    const line = memoryLine(pet, NOW, () => 0);
    expect(line).toBe(eligibleMemories(pet, NOW)[0].lines[0]);
  });

  it("returns null when there is nothing to retell", () => {
    const pet = adult([], { stage: "child", form: null });
    expect(memoryLine(pet, NOW)).toBeNull();
  });
});

describe("memoryChance", () => {
  it("scales by form — the ghost dwells, the dog lives in the now", () => {
    const ghost = adult([], { form: "ghost" });
    const dog = adult([], { form: "dog" });
    expect(memoryChance(ghost)).toBeGreaterThan(memoryChance(dog));
    expect(memoryChance(dog)).toBeGreaterThan(0);
  });
});
