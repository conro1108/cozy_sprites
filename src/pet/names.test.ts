import { describe, expect, it } from "vitest";
import { STARTER_NAMES, randomName } from "./names";

describe("starter names", () => {
  it("offers a big bank of distinct, input-safe suggestions", () => {
    expect(STARTER_NAMES.length).toBeGreaterThanOrEqual(180);
    // No duplicates — a reroll should feel like it actually changed something.
    expect(new Set(STARTER_NAMES).size).toBe(STARTER_NAMES.length);
    for (const n of STARTER_NAMES) {
      expect(n).toBe(n.trim());
      expect(n.length).toBeGreaterThan(0);
      expect(n.length).toBeLessThanOrEqual(12); // matches the input's maxlength
    }
  });

  it("randomName always returns a member of the bank", () => {
    expect(STARTER_NAMES).toContain(randomName(() => 0));
    expect(STARTER_NAMES).toContain(randomName(() => 0.5));
    expect(STARTER_NAMES).toContain(randomName(() => 0.999999));
  });
});
