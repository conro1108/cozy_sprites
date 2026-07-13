import { describe, expect, it } from "vitest";
import {
  judgeHigherLower,
  judgeRps,
  randomWouldYou,
  resolveFetch,
  rollFetchSpot,
  fetchSuccessHalfWidth,
  rpsAiMove,
  extendHum,
  humMatches,
  cubeHumLine,
  cubeHumCredit,
  spriteWon,
  CUBE_FACES,
} from "./games";

describe("spriteWon", () => {
  it("inverts the player's result in adversarial games", () => {
    expect(spriteWon("rps", true)).toBe(false);
    expect(spriteWon("rps", false)).toBe(true);
    expect(spriteWon("hideseek", true)).toBe(false);
    expect(spriteWon("hideseek", false)).toBe(true);
  });
  it("shares the player's result in cooperative and vs-the-world games", () => {
    expect(spriteWon("fetch", true)).toBe(true);
    expect(spriteWon("fetch", false)).toBe(false);
    expect(spriteWon("higherlower", true)).toBe(true);
    expect(spriteWon("cubehum", false)).toBe(false);
  });
});

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
  it("tags a failure with one of the fumble variants and a genuine reaction line", () => {
    const r = resolveFetch(0.05, () => 0);
    expect(["wrongway", "overfence", "sock", "stick", "whichway", "distracted"]).toContain(r.variant);
    expect(r.line.length).toBeGreaterThan(0);
  });
  it("keeps the wrong-object returns rare across the fail pool", () => {
    // Sweep the rng range: sock+stick together should be a small slice of fails.
    let wrongObject = 0;
    const n = 200;
    for (let i = 0; i < n; i++) {
      const roll = i / n;
      const r = resolveFetch(0.05, () => roll);
      if (r.variant === "sock" || r.variant === "stick") wrongObject++;
    }
    expect(wrongObject / n).toBeLessThan(0.2);
    expect(wrongObject).toBeGreaterThan(0);
  });
  it("babies fumble even a perfect throw, ordinarily", () => {
    expect(resolveFetch(0.6, () => 0, "baby").success).toBe(false);
    expect(resolveFetch(0.6, () => 0, "adult").success).toBe(true);
  });
  it("babies land one occasionally, so fetch isn't a guaranteed loss for a whole stage", () => {
    // A bad throw a baby would ordinarily fumble regardless of quality —
    // but a rare lucky roll succeeds anyway, and quietly (baby luck is
    // never an "epic" catch). 0.9 clears the luck threshold (>0.88) without
    // also tripping the rarer "brings back the cube" roll (>0.93).
    const r = resolveFetch(0.05, () => 0.9, "baby");
    expect(r.success).toBe(true);
    expect(r.variant).toBe("return");
  });
  it("a baby's ordinary roll still fumbles a bad throw", () => {
    expect(resolveFetch(0.05, () => 0.5, "baby").success).toBe(false);
  });
  it("rarely returns the cube instead, and it always counts", () => {
    const r = resolveFetch(0.05, () => 0.95); // terrible throw, cube anyway
    expect(r.variant).toBe("cube");
    expect(r.success).toBe(true);
    expect(r.line.length).toBeGreaterThan(0);
  });

  it("judges against a moved sweet spot, not the fixed center", () => {
    const spot = { center: 0.2, span: 0.5 };
    // Dead center of the moved zone succeeds; the old 0.6 center now misses.
    expect(resolveFetch(0.2, () => 0, "adult", spot).success).toBe(true);
    expect(resolveFetch(0.6, () => 0, "adult", spot).success).toBe(false);
  });

  it("a wider span forgives a throw a narrow one rejects", () => {
    const throwAt = 0.9; // well off a center of 0.6
    const wide = resolveFetch(throwAt, () => 0, "adult", { center: 0.6, span: 0.62 });
    const narrow = resolveFetch(throwAt, () => 0, "adult", { center: 0.6, span: 0.32 });
    expect(wide.success).toBe(true);
    expect(narrow.success).toBe(false);
  });
});

describe("rollFetchSpot", () => {
  it("keeps the whole green band on the track for any roll", () => {
    for (let i = 0; i <= 20; i++) {
      const spot = rollFetchSpot(() => i / 20);
      const hw = fetchSuccessHalfWidth(spot.span);
      expect(spot.center - hw).toBeGreaterThanOrEqual(0);
      expect(spot.center + hw).toBeLessThanOrEqual(1);
    }
  });

  it("varies difficulty — a low roll is tighter than a high roll", () => {
    const easy = rollFetchSpot(() => 0.99);
    const hard = rollFetchSpot(() => 0.01);
    expect(easy.span).toBeGreaterThan(hard.span);
  });
});

describe("The Cube's Hum", () => {
  it("extends the hum by exactly one valid face", () => {
    const seq = extendHum([1, 2], () => 0.5);
    expect(seq).toHaveLength(3);
    expect(seq.slice(0, 2)).toEqual([1, 2]); // keeps the existing hum
    const face = seq[2];
    expect(face).toBeGreaterThanOrEqual(0);
    expect(face).toBeLessThan(CUBE_FACES);
  });

  it("treats a correct prefix as still-alive but a wrong note as a miss", () => {
    const seq = [0, 3, 1];
    expect(humMatches(seq, [])).toBe(true); // nothing wrong yet
    expect(humMatches(seq, [0, 3])).toBe(true); // correct prefix
    expect(humMatches(seq, [0, 3, 1])).toBe(true); // full, correct
    expect(humMatches(seq, [0, 2])).toBe(false); // wrong note
    expect(humMatches(seq, [0, 3, 1, 0])).toBe(false); // over-hummed
  });

  it("has a spoken verdict for both outcomes", () => {
    expect(cubeHumLine(true, () => 0).length).toBeGreaterThan(0);
    expect(cubeHumLine(false, () => 0).length).toBeGreaterThan(0);
  });

  it("pays more credit the farther the endless hum gets, and caps", () => {
    // A miss on the first note (0 rounds) still pays a small bump.
    expect(cubeHumCredit(0)).toBeCloseTo(0.4);
    // Strictly increasing with distance.
    expect(cubeHumCredit(2)).toBeGreaterThan(cubeHumCredit(0));
    expect(cubeHumCredit(5)).toBeGreaterThan(cubeHumCredit(2));
    // Caps so a marathon run can't overflow the meter.
    expect(cubeHumCredit(100)).toBe(3);
    // A long run beats a one-round clear by a lot.
    expect(cubeHumCredit(8)).toBeGreaterThan(cubeHumCredit(1));
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
    expect(seen.size).toBeGreaterThanOrEqual(500);
  });
});
