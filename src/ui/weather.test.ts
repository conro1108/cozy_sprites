import { afterEach, describe, expect, it, vi } from "vitest";
import { weatherToday } from "./weather";

// The node test env has no localStorage; weather only needs this much of one.
const store = new Map<string, string>();
vi.stubGlobal("localStorage", {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, String(v)),
  removeItem: (k: string) => void store.delete(k),
});

afterEach(() => store.clear());

/** Every day of a given year, at noon. */
function year(y: number): Date[] {
  const days: Date[] = [];
  for (let d = new Date(y, 0, 1, 12); d.getFullYear() === y; d.setDate(d.getDate() + 1)) {
    days.push(new Date(d));
  }
  return days;
}

describe("weatherToday", () => {
  it("is deterministic: the same date always gets the same sky", () => {
    const d = new Date(2026, 6, 18, 9, 30);
    const first = weatherToday(d);
    for (let hour = 0; hour < 24; hour++) {
      expect(weatherToday(new Date(2026, 6, 18, hour, 45))).toBe(first);
    }
  });

  it("stays wet roughly one day in five across a year", () => {
    const wet = year(2026).filter((d) => weatherToday(d) !== "clear").length;
    // hash % 5 === 0 → expect ~73 of 365; leave slack for hash unevenness.
    expect(wet).toBeGreaterThan(40);
    expect(wet).toBeLessThan(110);
  });

  it("snows only in winter; rains otherwise", () => {
    for (const d of year(2026)) {
      const w = weatherToday(d);
      if (w === "clear") continue;
      const m = d.getMonth();
      const winter = m === 11 || m === 0 || m === 1;
      expect(w).toBe(winter ? "snow" : "rain");
    }
  });

  it("honors the localStorage override for a peek", () => {
    localStorage.setItem("cozy-sprites-weather", "snow");
    expect(weatherToday(new Date(2026, 6, 18))).toBe("snow");
    localStorage.setItem("cozy-sprites-weather", "clear");
    expect(weatherToday(new Date(2026, 6, 18))).toBe("clear");
    // Junk values fall through to the real roll.
    localStorage.setItem("cozy-sprites-weather", "frogs");
    const real = weatherToday(new Date(2026, 6, 18));
    expect(["clear", "rain", "snow"]).toContain(real);
  });
});
