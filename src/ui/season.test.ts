import { afterEach, describe, expect, it, vi } from "vitest";
import { seasonToday } from "./season";

// The node test env has no localStorage; season only needs this much of one.
const store = new Map<string, string>();
vi.stubGlobal("localStorage", {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, String(v)),
  removeItem: (k: string) => void store.delete(k),
});

afterEach(() => store.clear());

describe("seasonToday", () => {
  it("maps every month to its meteorological season", () => {
    const expected = [
      "winter", // Jan
      "winter", // Feb
      "spring", // Mar
      "spring", // Apr
      "spring", // May
      "summer", // Jun
      "summer", // Jul
      "summer", // Aug
      "fall", // Sep
      "fall", // Oct
      "fall", // Nov
      "winter", // Dec
    ];
    for (let m = 0; m < 12; m++) {
      expect(seasonToday(new Date(2026, m, 15))).toBe(expected[m]);
    }
  });

  it("agrees with the weather's snow months at both boundaries", () => {
    expect(seasonToday(new Date(2026, 10, 30))).toBe("fall");
    expect(seasonToday(new Date(2026, 11, 1))).toBe("winter");
    expect(seasonToday(new Date(2027, 1, 28))).toBe("winter");
    expect(seasonToday(new Date(2027, 2, 1))).toBe("spring");
  });

  it("honors the localStorage override for a peek", () => {
    localStorage.setItem("cozy-sprites-season", "winter");
    expect(seasonToday(new Date(2026, 6, 18))).toBe("winter");
    // Junk values fall through to the real calendar.
    localStorage.setItem("cozy-sprites-season", "monsoon");
    expect(seasonToday(new Date(2026, 6, 18))).toBe("summer");
  });
});
