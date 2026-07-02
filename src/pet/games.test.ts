import { describe, expect, it } from "vitest";
import {
  judgeHigherLower,
  judgeRps,
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
});
