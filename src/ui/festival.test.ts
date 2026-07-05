import { describe, expect, it } from "vitest";
import { festivalTonight } from "./festival";

const at = (y: number, m: number, d: number, h: number) => new Date(y, m, d, h);

describe("festivalTonight", () => {
  it("never holds a festival during the day", () => {
    for (let day = 1; day <= 28; day++) {
      for (const h of [5, 9, 12, 15, 18]) {
        expect(festivalTonight(at(2026, 6, day, h))).toBe(false);
      }
    }
  });

  it("is deterministic for the same evening", () => {
    for (let day = 1; day <= 28; day++) {
      const a = festivalTonight(at(2026, 6, day, 21));
      expect(festivalTonight(at(2026, 6, day, 21))).toBe(a);
      expect(festivalTonight(at(2026, 6, day, 23))).toBe(a);
    }
  });

  it("keeps the party going past midnight — 2am belongs to yesterday evening", () => {
    for (let day = 1; day <= 28; day++) {
      expect(festivalTonight(at(2026, 6, day + 1, 2))).toBe(
        festivalTonight(at(2026, 6, day, 22)),
      );
    }
  });

  it("happens on some evenings but stays rare-ish", () => {
    let festivals = 0;
    for (let i = 0; i < 365; i++) {
      const d = new Date(2026, 0, 1, 21);
      d.setDate(d.getDate() + i);
      if (festivalTonight(d)) festivals++;
    }
    expect(festivals).toBeGreaterThan(30);
    expect(festivals).toBeLessThan(160);
  });
});
