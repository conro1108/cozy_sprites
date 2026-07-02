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
});
