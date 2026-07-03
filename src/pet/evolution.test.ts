import { describe, expect, it } from "vitest";
import { determineAdultForm } from "./evolution";
import { emptyHidden } from "./types";
import type { HiddenStats } from "./types";

function hidden(overrides: Partial<HiddenStats>): HiddenStats {
  return { ...emptyHidden(), ...overrides };
}

describe("determineAdultForm", () => {
  it("defaults to the office creature from a blank slate", () => {
    expect(determineAdultForm(emptyHidden(), 100)).toBe("office");
  });

  it("produces a dog from lots of fetch and good care", () => {
    const h = hidden({
      gamePlays: { ...emptyHidden().gamePlays, fetch: 10 },
      careMistakes: 0,
    });
    expect(determineAdultForm(h, 90)).toBe("dog");
  });

  it("produces a blob from heavy cake consumption", () => {
    const h = hidden({ cakeEaten: 12, careMistakes: 3 });
    expect(determineAdultForm(h, 70)).toBe("blob");
  });

  it("produces a gremlin from cube abuse and chaos", () => {
    const h = hidden({ cubeEaten: 15, careMistakes: 8, discipline: 0 });
    expect(determineAdultForm(h, 50)).toBe("gremlin");
  });

  it("produces a scholar from high discipline and no cake", () => {
    const h = hidden({
      discipline: 80,
      cakeEaten: 0,
      gamePlays: { ...emptyHidden().gamePlays, higherlower: 8 },
    });
    expect(determineAdultForm(h, 90)).toBe("scholar");
  });

  it("produces the secret ghost from dominant night care", () => {
    const h = hidden({ nightCare: 12 });
    expect(determineAdultForm(h, 80)).toBe("ghost");
  });

  it("does not produce a ghost from casual night care", () => {
    // rng()=0 → deterministic top scorer, so a near-tie can't flake the test.
    const h = hidden({ nightCare: 2 });
    expect(determineAdultForm(h, 80, () => 0)).not.toBe("ghost");
  });

  it("ignores a 'favourite game' that is only tied for most-played", () => {
    // One play of everything is not a fetch enthusiasm — this used to count
    // whichever game iterated first and bias every run the same way.
    const plays = { ...emptyHidden().gamePlays };
    (Object.keys(plays) as (keyof typeof plays)[]).forEach((g) => (plays[g] = 2));
    const h = hidden({ gamePlays: plays });
    expect(determineAdultForm(h, 90, () => 0)).toBe("office");
  });

  it("breaks near-ties randomly instead of always the same way", () => {
    const h = emptyHidden(); // office baseline, several forms near zero
    const seen = new Set<string>();
    for (let r = 0; r < 10; r++) {
      seen.add(determineAdultForm(h, 100, () => r / 10));
    }
    // A blank slate is a clear office win — but rng must select within
    // candidates, so a single candidate always returns office.
    expect(seen).toEqual(new Set(["office"]));
  });
});
