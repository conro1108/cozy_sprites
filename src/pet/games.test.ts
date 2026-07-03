import { describe, expect, it } from "vitest";
import {
  judgeHigherLower,
  judgeRps,
  randomWouldYou,
  resolveFetch,
  rpsAiMove,
} from "./games";

describe("judgeRps", () => {
  it("rock beats scissors", () => {
    expect(judgeRps("rock", "scissors")).toBe("win");
  });
  it("rock loses to paper", () => {
    expect(judgeRps("rock", "paper")).toBe("lose");
  });
  it("matching moves tie", () => {
    expect(judgeRps("paper", "paper")).toBe("tie");
  });
});

describe("rpsAiMove", () => {
  it("a cheating AI always beats the player", () => {
    expect(judgeRps("rock", rpsAiMove("rock", true))).toBe("lose");
    expect(judgeRps("scissors", rpsAiMove("scissors", true))).toBe("lose");
  });
});

describe("judgeHigherLower", () => {
  it("rewards a correct higher guess", () => {
    expect(judgeHigherLower(3, true, 7)).toBe("win");
  });
  it("punishes a wrong lower guess", () => {
    expect(judgeHigherLower(3, false, 7)).toBe("lose");
  });
  it("ties on an equal draw", () => {
    expect(judgeHigherLower(5, true, 5)).toBe("tie");
  });
});

describe("resolveFetch", () => {
  it("succeeds near the sweet spot", () => {
    expect(resolveFetch(0.6, () => 0).success).toBe(true);
  });
  it("fails at the edges", () => {
    expect(resolveFetch(0.05, () => 0).success).toBe(false);
  });
  it("tags a success with a success variant and a matching line", () => {
    const r = resolveFetch(0.6, () => 0);
    expect(["return", "epic"]).toContain(r.variant);
    expect(r.line.length).toBeGreaterThan(0);
  });
  it("tags a failure with one of the fumble variants", () => {
    const r = resolveFetch(0.05, () => 0);
    expect(["wrongway", "overfence", "sock", "distracted"]).toContain(r.variant);
    expect(r.line.length).toBeGreaterThan(0);
  });
  it("babies fumble even a perfect throw", () => {
    expect(resolveFetch(0.6, () => 0, "baby").success).toBe(false);
    expect(resolveFetch(0.6, () => 0, "adult").success).toBe(true);
  });
  it("rarely returns the cube instead, and it always counts", () => {
    const r = resolveFetch(0.05, () => 0.95); // terrible throw, cube anyway
    expect(r.variant).toBe("cube");
    expect(r.success).toBe(true);
    expect(r.line.length).toBeGreaterThan(0);
  });
});

describe("randomWouldYou", () => {
  it("has a deep bank of well-formed questions", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 1000; i++) {
      const q = randomWouldYou(() => i / 1000);
      expect(q.a.length).toBeGreaterThan(0);
      expect(q.b.length).toBeGreaterThan(0);
      expect(q.judgeA.length).toBeGreaterThan(0);
      expect(q.judgeB.length).toBeGreaterThan(0);
      seen.add(q.a);
    }
    expect(seen.size).toBeGreaterThanOrEqual(170);
  });
});
